import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Authenticated app surfaces that must NOT be framable (clickjacking defense).
 * Public booking pages (`/[handle]/[slug]`, `/book/*`) and the embed script are
 * deliberately left framable so customers can embed them.
 */
const FRAME_DENY = [
  "/dashboard",
  "/inbox",
  "/event-types",
  "/teams",
  "/bookings",
  "/insights",
  "/analytics",
  "/availability",
  "/settings",
];

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const p = req.nextUrl.pathname;

  // Baseline hardening on every response.
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");

  // Deny framing of the authenticated app; leave public/embeddable pages alone.
  if (FRAME_DENY.some((prefix) => p === prefix || p.startsWith(`${prefix}/`))) {
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Content-Security-Policy", "frame-ancestors 'none'");
  }

  return res;
}

export const config = {
  // Everything except Next internals + static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
