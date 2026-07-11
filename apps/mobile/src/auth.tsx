import { type ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, api, clearToken, hasSession, setToken } from "./api";
import { authClient } from "./auth-client";
import type { AppUser } from "./models";

interface AuthState {
  user: AppUser | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    (async () => {
      try {
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
      const data = await api.post<AuthResponse>(path, body);
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
   * browser, returns through the calsync:// deep link). We then mint a bearer
   * token so the rest of the app keeps using the same api.ts auth path.
   */
  async function signInWithGoogle(): Promise<string | null> {
    try {
      const res = await authClient.signIn.social({ provider: "google", callbackURL: "/" });
      if (res.error) return res.error.message ?? "Google sign-in failed";
      // The Expo client now holds the session cookie; api.ts sends it. Confirm
      // by loading the profile.
      const { user: me } = await api.get<{ user: AppUser }>("/api/me");
      setUser(me);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Google sign-in failed";
    }
  }

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signIn: (email, password) => authenticate("/api/auth/sign-in/email", { email, password }),
      signUp: (name, email, password) =>
        authenticate("/api/auth/sign-up/email", { name, email, password }),
      signInWithGoogle,
      signOut: async () => {
        await authClient.signOut().catch(() => {});
        await clearToken();
        setUser(null);
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
