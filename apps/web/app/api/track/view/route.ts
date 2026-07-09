import { getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  eventTypeId: z.string().uuid(),
  visitorId: z.string().min(1).max(64).optional(),
});

/**
 * Public, unauthenticated funnel beacon: records a view of an event-type
 * booking page. Always answers 204 (even on bad input) so it never leaks
 * whether an id exists and never blocks the page. The FK guarantees we only
 * store views for real event types — an invalid id just no-ops.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });

  try {
    await getDb().insert(schema.bookingPageViews).values({
      eventTypeId: parsed.data.eventTypeId,
      visitorId: parsed.data.visitorId,
    });
  } catch {
    // Unknown event type (FK violation) or transient error — ignore.
  }
  return new NextResponse(null, { status: 204 });
}
