import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, clearToken, hasSession, setToken } from "./api";
import { clearBetterAuthSession, getAuthClient } from "./auth-client";
import type { AppUser } from "./models";
import { loadServerUrl } from "./server";

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
      // The account has 2FA on. Native TOTP entry isn't wired yet, so point the
      // user at a path that works today rather than a bare "failed" (they can
      // still use Google / phone / the web).
      if (data.twoFactorRedirect) {
        return "This account uses two-factor authentication. Sign in with Google, a phone number, or on the web for now.";
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

  // The handler closures are stable enough for our needs; re-memoizing only when
  // user/initializing change is intentional (adding them would defeat the memo).
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
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
