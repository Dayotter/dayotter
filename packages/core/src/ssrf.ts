import { lookup } from "node:dns/promises";
import net from "node:net";

/** Raised when a URL is rejected for pointing at a non-public / internal target. */
export class SsrfError extends Error {}

// Fast first-pass block by hostname (catches the obvious literals before any DNS).
const BLOCKED_HOST =
  /^(localhost|.*\.local|.*\.internal|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|::1|\[?::1\]?|\[?fc00:|\[?fd00:|\[?fe80:)/i;
const BLOCKED_172 = /^172\.(1[6-9]|2\d|3[01])\./;

/**
 * Parse + sanity-check a user-supplied URL for server-side fetching. Rejects
 * non-http(s) schemes and obviously-internal hostnames. Use at input time; the
 * authoritative check is `resolvePublicIp` at fetch time (DNS can change).
 */
export function assertPublicHttpUrl(raw: string, opts: { requireHttps?: boolean } = {}): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError("Invalid URL");
  }
  if (opts.requireHttps) {
    if (url.protocol !== "https:") throw new SsrfError("URL must use https");
  } else if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new SsrfError("URL must use http or https");
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOST.test(host) || BLOCKED_172.test(host)) {
    throw new SsrfError("URL points at a disallowed internal host");
  }
  return url;
}

/** True for loopback / private / link-local / CGNAT / multicast / reserved IPs. */
export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".");
    const a = Number(p[0]);
    const b = Number(p[1]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local (incl. cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a >= 224) return true; // multicast / reserved
    return false;
  }
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::1" || v === "::" || v === "::ffff:0:0") return true;
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local
  if (v.startsWith("fe80")) return true; // link-local
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped?.[1]) return isPrivateIp(mapped[1]);
  return false;
}

/**
 * Resolve `hostname` and ensure EVERY resolved address is public; throws
 * otherwise. Returns one validated address so the caller can pin the connection
 * to it (defeating DNS-rebinding between check and connect).
 */
export async function resolvePublicIp(hostname: string): Promise<{ address: string; family: number }> {
  let results: { address: string; family: number }[];
  try {
    results = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfError("Host did not resolve");
  }
  if (results.length === 0) throw new SsrfError("Host did not resolve");
  for (const r of results) {
    if (isPrivateIp(r.address)) {
      throw new SsrfError("Host resolves to a disallowed internal address");
    }
  }
  const first = results[0]!;
  return { address: first.address, family: first.family };
}
