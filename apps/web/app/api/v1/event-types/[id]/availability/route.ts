import { getEventTypeAvailability } from "@/lib/booking/availability";
import { withApiKey } from "@/lib/server/api-key";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_WINDOW_MS = 62 * 86_400_000; // ~2 months per request

/** GET /api/v1/event-types/:id/availability?from&to&duration — bookable slots. */
export const GET = withApiKey(async (caller, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;

  // Scope to the caller's own event types (no cross-tenant availability leak).
  const owned = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, caller.userId)),
    columns: { id: true },
  });
  if (!owned) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

  const url = new URL(request.url);
  const durationRaw = Number(url.searchParams.get("duration"));
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : undefined;

  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date();
  if (Number.isNaN(from.getTime())) return NextResponse.json({ error: "Invalid from" }, { status: 400 });
  const requestedTo = url.searchParams.get("to")
    ? new Date(url.searchParams.get("to")!)
    : new Date(from.getTime() + 14 * 86_400_000);
  if (Number.isNaN(requestedTo.getTime()) || requestedTo <= from) {
    return NextResponse.json({ error: "`to` must be a valid time after `from`" }, { status: 400 });
  }
  const to = new Date(Math.min(requestedTo.getTime(), from.getTime() + MAX_WINDOW_MS));

  const slots = await getEventTypeAvailability(id, from, to, duration);
  if (slots === null) return NextResponse.json({ error: "Event type not found" }, { status: 404 });

  return NextResponse.json({
    eventTypeId: id,
    from: from.toISOString(),
    to: to.toISOString(),
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
  });
});
