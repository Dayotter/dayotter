import * as SecureStore from "expo-secure-store";

/**
 * Backend base URL. Override at build/run time with:
 *   npx expo start --dart... (no) → set EXPO_PUBLIC_API_URL in env, e.g.
 *   EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start
 * iOS simulator can use http://localhost:3000; Android emulator uses
 * http://10.0.2.2:3000 to reach the host machine.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
  const token = await getToken();
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
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
