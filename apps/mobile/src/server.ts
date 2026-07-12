import * as SecureStore from "expo-secure-store";
import { DEFAULT_SERVER_URL } from "./config";

export { DEFAULT_SERVER_URL };

/**
 * Runtime backend selection ("bring your own server"). The app ships pointing at
 * the hosted cloud (DEFAULT_SERVER_URL); a self-hoster can switch it to their own
 * DayOtter instance from the Server screen. The chosen URL is persisted and read
 * synchronously by api.ts / auth-client.ts on every request.
 */

const KEY = "dayotter_server_url";

let current = DEFAULT_SERVER_URL;

/** Add https:// if the scheme is missing and strip any trailing slashes. */
export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

/** Load the saved server URL into memory. Call once on boot before any request. */
export async function loadServerUrl(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved) current = saved;
  } catch {
    /* keep the default */
  }
  return current;
}

/** Current backend base URL (no trailing slash). Safe to read synchronously. */
export function getServerUrl(): string {
  return current;
}

/** Whether the app is still pointed at the shipped default (hosted cloud). */
export function isDefaultServer(): boolean {
  return current === DEFAULT_SERVER_URL;
}

/** Bare host for display, e.g. "dayotter.com". */
export function serverHost(url: string = current): string {
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

/** Persist and switch to a new server URL (input is normalized first). */
export async function setServerUrl(input: string): Promise<void> {
  current = normalizeServerUrl(input);
  await SecureStore.setItemAsync(KEY, current);
}

/** Forget the custom server and return to the shipped default. */
export async function resetServerUrl(): Promise<void> {
  current = DEFAULT_SERVER_URL;
  await SecureStore.deleteItemAsync(KEY);
}

export interface ProbeResult {
  ok: boolean;
  error?: string;
  /** Reachable DayOtter server, but its own DB/Redis is currently unhealthy. */
  degraded?: boolean;
}

/**
 * Probe a candidate URL's /api/health to confirm it's a reachable DayOtter
 * server before we switch to it. Times out after 8s.
 */
export async function probeServer(input: string): Promise<ProbeResult> {
  const base = normalizeServerUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/api/health`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    });
    const body = (await res.json().catch(() => null)) as {
      service?: string;
      status?: string;
    } | null;
    if (!body || typeof body.service !== "string" || !body.service.includes("dayotter")) {
      return { ok: false, error: "That responded, but it doesn't look like a DayOtter server." };
    }
    return { ok: true, degraded: res.status !== 200 || body.status !== "ok" };
  } catch {
    return { ok: false, error: "Couldn't reach that server. Check the URL and that it's online." };
  } finally {
    clearTimeout(timer);
  }
}
