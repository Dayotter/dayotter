import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, clearToken, getToken, setToken } from "./api";
import type { AppUser } from "./models";

interface AuthState {
  user: AppUser | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (name: string, email: string, password: string) => Promise<string | null>;
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
        if (await getToken()) {
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

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signIn: (email, password) => authenticate("/api/auth/sign-in/email", { email, password }),
      signUp: (name, email, password) =>
        authenticate("/api/auth/sign-up/email", { name, email, password }),
      signOut: async () => {
        await clearToken();
        setUser(null);
      },
    }),
    [user, initializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
