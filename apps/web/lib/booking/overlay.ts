import https from "node:https";
import { assertPublicHttpUrl, resolvePublicIp } from "@calsync/core";
import ical from "node-ical";

/**
 * SavvyCal-style calendar overlay: given a booker-supplied calendar feed URL,
 * return the busy intervals in a window so the public booking page can grey out
 * slots that clash with the booker's OWN commitments. The feed is fetched
 * per-request and never stored; only busy/free times are derived from it.
 */

export interface BusyInterval {
  start: string; // ISO
  end: string; // ISO
}

const MAX_BYTES = 3_000_000; // 3 MB — plenty for a personal calendar feed
const TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

/**
 * Fetch a calendar feed with SSRF protection: HTTPS-only, hostname + DNS both
 * validated against internal ranges, the connection PINNED to the validated
 * public IP (defeats DNS-rebinding), a size + time cap, and manual redirect
 * handling that re-validates every hop. `webcal://` is rewritten to `https://`.
 */
async function fetchFeed(rawUrl: string, redirectsLeft = MAX_REDIRECTS): Promise<string> {
  const normalized = rawUrl.trim().replace(/^webcal:\/\//i, "https://");
  const url = assertPublicHttpUrl(normalized, { requireHttps: true });
  const pinned = await resolvePublicIp(url.hostname);

  return await new Promise<string>((resolve, reject) => {
    const req = https.request(
      {
        host: pinned.address, // connect to the validated IP, not a re-resolved host
        servername: url.hostname, // SNI + certificate hostname validation
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { host: url.host, accept: "text/calendar, text/plain" },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        // Follow a redirect, but re-validate the new URL through the SSRF guard.
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsLeft <= 0) return reject(new Error("too many redirects"));
          const next = new URL(res.headers.location, url).toString();
          fetchFeed(next, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (status !== 200) {
          res.resume();
          return reject(new Error(`feed returned ${status}`));
        }
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => {
          bytes += c.length;
          if (bytes > MAX_BYTES) req.destroy(new Error("feed too large"));
          else chunks.push(c);
        });
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("timeout", () => req.destroy(new Error("feed timed out")));
    req.on("error", reject);
    req.end();
  });
}

/** Number of ms in `d`, or null if `d` isn't a Date. */
function asDate(d: unknown): Date | null {
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/**
 * Parse an ICS document into busy intervals overlapping [from, to]. Recurrence-
 * aware (expands RRULE occurrences, honours EXDATE and moved instances) and
 * skips events marked free (TRANSPARENT) or CANCELLED. Best-effort — exotic
 * timezone/recurrence edge cases may be approximate. Exported for unit testing.
 */
export function icsToBusy(icsText: string, from: Date, to: Date): BusyInterval[] {
  let data: Record<string, unknown>;
  try {
    data = ical.parseICS(icsText) as Record<string, unknown>;
  } catch {
    return [];
  }

  const out: { start: Date; end: Date }[] = [];
  const overlaps = (s: Date, e: Date) => s < to && e > from;

  for (const key of Object.keys(data)) {
    const ev = data[key] as {
      type?: string;
      start?: unknown;
      end?: unknown;
      transparency?: string;
      status?: string;
      rrule?: { between: (a: Date, b: Date, inc?: boolean) => Date[] };
      exdate?: Record<string, unknown>;
      recurrences?: Record<string, { start?: unknown; end?: unknown }>;
    };
    if (!ev || ev.type !== "VEVENT") continue;
    if (ev.transparency === "TRANSPARENT" || ev.status === "CANCELLED") continue;

    const start = asDate(ev.start);
    if (!start) continue;
    const end = asDate(ev.end) ?? new Date(start.getTime() + 30 * 60_000);
    const durationMs = Math.max(end.getTime() - start.getTime(), 0);

    if (ev.rrule) {
      const exdates = new Set(
        Object.values(ev.exdate ?? {})
          .map((d) => asDate(d)?.getTime())
          .filter((t): t is number => t != null),
      );
      for (const raw of ev.rrule.between(from, to, true)) {
        const occ = asDate(raw);
        if (!occ) continue;
        // node-ical's rrule returns each occurrence shifted by the SERVER's local
        // tz offset (it treats the UTC dtstart as wall-clock). Undo that so the
        // instant is correct regardless of where this runs. (UTC server → no-op.)
        const oStart = new Date(occ.getTime() + occ.getTimezoneOffset() * 60_000);
        if (exdates.has(oStart.getTime()) || exdates.has(occ.getTime())) continue;
        out.push({ start: oStart, end: new Date(oStart.getTime() + durationMs) });
      }
      // Moved/overridden instances (RECURRENCE-ID) node-ical exposes separately.
      for (const r of Object.values(ev.recurrences ?? {})) {
        const rs = asDate(r.start);
        const re = asDate(r.end) ?? (rs ? new Date(rs.getTime() + durationMs) : null);
        if (rs && re && overlaps(rs, re)) out.push({ start: rs, end: re });
      }
    } else if (overlaps(start, end)) {
      out.push({ start, end });
    }
  }

  return out
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((i) => ({ start: i.start.toISOString(), end: i.end.toISOString() }));
}

/** Fetch + parse a booker's calendar feed into busy intervals for [from, to]. */
export async function fetchBookerBusy(
  icsUrl: string,
  from: Date,
  to: Date,
): Promise<BusyInterval[]> {
  const text = await fetchFeed(icsUrl);
  return icsToBusy(text, from, to);
}
