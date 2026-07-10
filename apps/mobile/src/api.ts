import * as SecureStore from "expo-secure-store";
import { authClient } from "./auth-client";
import { BASE_URL } from "./config";

export { BASE_URL };

const TOKEN_KEY = "calsync_auth_token";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
export async function setToken(value: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, value);
}
export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

async function headers(): Promise<Record<string, string>> {
  // Email/password stores a bearer token; native Google sign-in leaves a session
  // in the Better Auth Expo client, so fall back to its cookie when there's no
  // bearer token. One of the two always carries the session.
  const token = await getToken();
  if (token) {
    return { "content-type": "application/json", authorization: `Bearer ${token}` };
  }
  const cookie = authClient.getCookie();
  return { "content-type": "application/json", ...(cookie ? { cookie } : {}) };
}

/** True when either auth mechanism holds a session (used on cold start). */
export async function hasSession(): Promise<boolean> {
  if (await getToken()) return true;
  return Boolean(authClient.getCookie());
}

async function handle(res: Response): Promise<unknown> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (res.ok) return body;
  const message =
    body && typeof body.error === "string" ? body.error : `Request failed (${res.status})`;
  throw new ApiError(res.status, message);
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers: await headers() });
    return handle(res) as Promise<T>;
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return handle(res) as Promise<T>;
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PUT",
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return handle(res) as Promise<T>;
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "PATCH",
      headers: await headers(),
      body: JSON.stringify(body),
    });
    return handle(res) as Promise<T>;
  },
  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: await headers() });
    return handle(res) as Promise<T>;
  },
};
