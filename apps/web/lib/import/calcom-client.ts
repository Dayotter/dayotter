import { safeFetch } from "@dayotter/core";
import type { CalcomExport } from "./calcom";

/** Cal.com cloud API base. Self-hosters pass their own `<instance>/api/v1`. */
export const DEFAULT_CALCOM_BASE = "https://api.cal.com/v1";

/** Cap the response so a huge/hostile payload can't exhaust memory. */
const MAX_BYTES = 5_000_000;
export const MAX_EVENT_TYPES = 200;

/** Thrown when Cal.com rejects the API key (401) - surfaced to the user distinctly. */
export class CalcomAuthError extends Error {
  constructor() {
    super("Cal.com rejected the API key");
    this.name = "CalcomAuthError";
  }
}

function normalizeBase(base: string): string {
  const trimmed = base.trim().replace(/\/+$/, "");
  // Accept either ".../api/v1" or ".../v1"; append /v1 if the caller gave a bare origin.
  return /\/v1$/.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Cal.com response too large");
      }
      chunks.push(value);
    }
  }
  return new TextDecoder().decode(
    chunks.reduce<Uint8Array>((acc, c) => {
      const merged = new Uint8Array(acc.length + c.length);
      merged.set(acc);
      merged.set(c, acc.length);
      return merged;
    }, new Uint8Array()),
  );
}

/**
 * Fetch a user's Cal.com event types via a v1 API key. SSRF-safe (the base URL is
 * user-supplied, so egress goes through the pinned `safeFetch`), size-capped, and
 * bounded to `MAX_EVENT_TYPES`. The key is used only for this request and never
 * stored. Cal.com v1 authenticates with an `apiKey` query param.
 */
export async function fetchCalcomEventTypes(
  apiKey: string,
  baseUrl: string = DEFAULT_CALCOM_BASE,
): Promise<CalcomExport> {
  const url = `${normalizeBase(baseUrl)}/event-types?apiKey=${encodeURIComponent(apiKey.trim())}`;
  const res = await safeFetch(url, {
    headers: { "content-type": "application/json" },
    timeoutMs: 15_000,
  });
  if (res.status === 401 || res.status === 403) throw new CalcomAuthError();
  if (!res.ok) throw new Error(`Cal.com returned ${res.status}`);

  const raw = await readCapped(res);
  let parsed: CalcomExport;
  try {
    parsed = JSON.parse(raw) as CalcomExport;
  } catch {
    throw new Error("Cal.com returned an unexpected (non-JSON) response");
  }
  if (parsed.event_types && parsed.event_types.length > MAX_EVENT_TYPES) {
    parsed.event_types = parsed.event_types.slice(0, MAX_EVENT_TYPES);
  }
  return parsed;
}
