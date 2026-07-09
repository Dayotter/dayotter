import { clientIp } from "@/lib/server/rate-limit";
import { rateLimit } from "@calsync/jobs";
import { getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  eventTypeId: z.string().uuid(),
  visitorId: z.string().min(1).max(64).optional(),
});

const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|curl|wget|python-|axios|fetch\b/i;

/**
 * Public, unauthenticated funnel beacon: records a view of an event-type
 * booking page. Always answers 204 (even on bad input) so it never leaks
 * whether an id exists and never blocks the page. The FK guarantees we only
 * store views for real event types. Rate-limited per IP+type and bot-filtered
 * so the funnel can't be trivially inflated/deflated.
 */
export async function POST(request: Request): Promise<Response> {
  const ok = new NextResponse(null, { status: 204 });

  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return ok; // drop crawlers/automation

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return ok;

  // At most ~30 views/min from one IP for one event type (fails open on Redis down).
  const { ok: allowed } = await rateLimit(
    `view:${clientIp(request)}:${parsed.data.eventTypeId}`,
    30,
    60,
  );
  if (!allowed) return ok;

  try {
    await getDb().insert(schema.bookingPageViews).values({
      eventTypeId: parsed.data.eventTypeId,
      visitorId: parsed.data.visitorId,
    });
  } catch {
    // Unknown event type (FK violation) or transient error — ignore.
  }
  return ok;
}
