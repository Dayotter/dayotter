import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, clearToken, hasSession, setToken } from "./api";
import { clearBetterAuthSession, getAuthClient } from "./auth-client";
import type { AppUser } from "./models";
import { loadServerUrl } from "./server";

/**
 * Sentinel returned by signIn when the account has 2FA on: the password was
 * accepted but an authenticator code is still needed. The caller shows the code
 * step (see `twoFactorPending`) instead of treating it as an error or success.
 */
export const TWO_FACTOR_REQUIRED = "__2fa_required__";

interface AuthState {
  user: AppUser | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  /** Text an OTP to the phone. Returns an error string or null on success. */
  sendPhoneOtp: (phone: string) => Promise<string | null>;
  /** Verify the OTP; on success a session is established and the user is set. */
  verifyPhoneOtp: (phone: string, code: string) => Promise<string | null>;
  /** True while a 2FA account is mid-sign-in and owes an authenticator code. */
  twoFactorPending: boolean;
  /** Complete a 2FA sign-in with a TOTP (or backup) code. */
  verifyTwoFactor: (code: string, useBackup: boolean) => Promise<string | null>;
  /** Abandon the 2FA step and return to the sign-in form. */
  cancelTwoFactor: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

interface AuthResponse {
  token?: string;
  user: AppUser;
}

/**
 * Load the signed-in profile, retrying through the brief window where a freshly
 * established Better Auth cookie hasn't been persisted yet (OAuth/phone flows).
 */
async function loadMeWithRetry(attempts = 6, delayMs = 250): Promise<AppUser | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      return (await api.get<{ user: AppUser }>("/api/me")).user;
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [twoFactorPending, setTwoFactorPending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Resolve the chosen backend before any request or session check.
        await loadServerUrl();
        if (await hasSession()) {
          const { user } = await api.get<{ user: AppUser }>("/api/me");
          setUser(user);
        }
      } catch {
        await clearToken();
      } finally {
        setInitializing(false);
      }
    })();
  }, []);

  async function authenticate(path: string, body: unknown): Promise<string | null> {
    try {
      const data = await api.post<AuthResponse & { twoFactorRedirect?: boolean }>(path, body);
      // The account has 2FA on: the password was accepted but an authenticator
      // code is still required. Re-run the sign-in through the Better Auth Expo
      // client so it captures the 2FA challenge cookie (the raw bearer POST above
      // can't), then hand off to the code step via `twoFactorPending`. Only 2FA
      // accounts take this path - everyone else stays on the bearer flow below.
      if (data.twoFactorRedirect) {
        const creds = body as { email?: string; password?: string };
        if (creds.email && creds.password) {
          try {
            await getAuthClient().signIn.email({ email: creds.email, password: creds.password });
          } catch {
            /* the client call also 2FA-redirects; we only need the cookie it sets */
          }
          setTwoFactorPending(true);
          return TWO_FACTOR_REQUIRED;
        }
        return "This account uses two-factor authentication. Sign in on the web for now.";
      }
      if (!data.token) return "Authentication failed";
      await setToken(data.token);
      setUser(data.user);
      return null;
    } catch (err) {
      if (err instanceof ApiError) return err.message;
      return "Could not reach the server";
    }
  }

  /**
   * Native Google sign-in via the Better Auth Expo bridge (opens the system
   * browser, returns through the dayotter:// deep link). We then mint a bearer
   * token so the rest of the app keeps using the same api.ts auth path.
   */
  async function signInWithGoogle(): Promise<string | null> {
    try {
      const res = await getAuthClient().signIn.social({ provider: "google", callbackURL: "/" });
      if (res.error) return res.error.message ?? "Google sign-in failed";
      // The Expo client persists the session cookie asynchronously after the
      // browser redirect, so the first /api/me can beat the cookie write and
      // 401 - which sent the user back to the login screen and made them sign in
      // twice. Retry briefly so the very first attempt lands.
      const me = await loadMeWithRetry();
      if (!me) return "Signed in, but couldn't load your profile - please try again.";
      setUser(me);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Google sign-in failed";
    }
  }

  async function sendPhoneOtp(phone: string): Promise<string | null> {
    const res = await getAuthClient().phoneNumber.sendOtp({ phoneNumber: phone });
    return res.error ? (res.error.message ?? "Couldn't send the code") : null;
  }

  /**
   * Verify the SMS code. Like Google, this leaves the session in the Expo client
   * (api.ts sends its cookie); we confirm by loading the profile. An unknown
   * number is auto-provisioned server-side (signUpOnVerification).
   */
  async function verifyPhoneOtp(phone: string, code: string): Promise<string | null> {
    try {
      const res = await getAuthClient().phoneNumber.verify({ phoneNumber: phone, code });
      if (res.error) return res.error.message ?? "That code didn't match";
      const me = await loadMeWithRetry();
      if (!me) return "Verified, but couldn't load your profile - please try again.";
      setUser(me);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Verification failed";
    }
  }

  /**
   * Finish a 2FA sign-in with an authenticator (or backup) code. The 2FA cookie
   * was set on the Expo client during `authenticate`; verify against it, then load
   * the profile over that session (like Google / phone - no bearer token).
   */
  async function verifyTwoFactor(code: string, useBackup: boolean): Promise<string | null> {
    try {
      const client = getAuthClient();
      const res = useBackup
        ? await client.twoFactor.verifyBackupCode({ code: code.trim() })
        : await client.twoFactor.verifyTotp({ code: code.trim() });
      if (res.error) {
        return (
          res.error.message ??
          (useBackup ? "That recovery code didn't match." : "That code didn't match.")
        );
      }
      const me = await loadMeWithRetry();
      if (!me) return "Signed in, but couldn't load your profile - please try again.";
      setUser(me);
      setTwoFactorPending(false);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Verification failed";
    }
  }

  // The handler closures are stable enough for our needs; re-memoizing only when
  // user/initializing/twoFactorPending change is intentional.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable auth closures
  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signIn: (email, password) => authenticate("/api/auth/sign-in/email", { email, password }),
      signUp: (name, email, password) =>
        authenticate("/api/auth/sign-up/email", { name, email, password }),
      signInWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      twoFactorPending,
      verifyTwoFactor,
      cancelTwoFactor: () => setTwoFactorPending(false),
      signOut: async () => {
        // Clear the account before anything else so a stale session can't leak
        // into the next sign-in: server signOut (best-effort), the bearer token,
        // AND the Better Auth Expo cookie storage.
        await getAuthClient()
          .signOut()
          .catch(() => {});
        await clearToken();
        await clearBetterAuthSession();
        setUser(null);
      },
    }),
    [user, initializing, twoFactorPending],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
