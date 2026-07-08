import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed OAuth `state` for the calendar-connection flow. Binds the callback to
 * the user who started it and carries a nonce, preventing CSRF / cross-user
 * account grafting. HMAC-SHA256 over the payload with AUTH_SECRET.
 *
 * Format: base64url(payloadJson) + "." + base64url(hmac)
 */

interface StatePayload {
  userId: string;
  provider: string;
  nonce: string;
  /** Issued-at epoch ms; callers reject stale states. */
  iat: number;
}

function secret(): string {
  const s = process.env.AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payloadB64: string): string {
  return createHmac("sha256", secret()).update(payloadB64).digest("base64url");
}

export function createState(input: Omit<StatePayload, "nonce" | "iat">, nonce: string): string {
  const payload: StatePayload = { ...input, nonce, iat: Date.now() };
  const payloadB64 = b64url(JSON.stringify(payload));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/** Verify signature + freshness. Returns the payload or null if invalid. */
export function verifyState(state: string, maxAgeMs = 10 * 60_000): StatePayload | null {
  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString()) as StatePayload;
    if (Date.now() - payload.iat > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}
