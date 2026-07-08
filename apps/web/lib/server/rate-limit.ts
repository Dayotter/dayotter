import { rateLimit } from "@calsync/jobs";
import { NextResponse } from "next/server";
import { env } from "./env";

/** Best-effort client IP from the proxy chain. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitOptions {
  /** Bucket name, e.g. "book" or "availability". */
  name: string;
  /** Max requests allowed in the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** Override the identity (defaults to client IP), e.g. IP + event type. */
  key?: string;
}

/**
 * Enforce a per-caller rate limit. Returns a 429 `NextResponse` when the caller
 * is over budget, or `null` to proceed. Fails open if Redis is down.
 */
export async function enforceRateLimit(
  req: Request,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  const id = opts.key ?? clientIp(req);
  const { ok, resetSec } = await rateLimit(`${opts.name}:${id}`, opts.limit, opts.windowSec);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please slow down and try again shortly." },
    { status: 429, headers: { "retry-after": String(Math.max(1, resetSec)) } },
  );
}

/**
 * Verify a Cloudflare Turnstile captcha token. No-op (returns true) unless
 * `TURNSTILE_SECRET` is configured, so the booking flow works without captcha in
 * dev / self-host until an operator opts in.
 */
export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = env.TURNSTILE_SECRET;
  if (!secret) return true; // captcha not enabled
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
