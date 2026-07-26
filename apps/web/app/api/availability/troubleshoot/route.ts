import { eventConstraints, troubleshootHostDay } from "@/lib/booking/availability";
import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Host-only diagnostic: why does a given event type offer (or not offer) slots on
 * a given day? Returns the schedule windows, booking-window/notice status, and a
 * per-day count of what's blocked by busy time vs notice, with plain-English
 * reasons. See lib/booking/availability#troubleshootHostDay.
 */
export const GET = withUser(async (u, request) => {
  const url = new URL(request.url);
  const eventTypeId = url.searchParams.get("eventTypeId");
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD
  if (!eventTypeId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return jsonError("eventTypeId and a YYYY-MM-DD date are required", 400);
  }
  const date = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return jsonError("Invalid date", 400);

  const et = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, eventTypeId),
  });
  if (!et || et.ownerId !== u.id) return jsonError("Event type not found", 404);

  const diagnosis = await troubleshootHostDay(
    u.id,
    et.scheduleId,
    eventConstraints(et),
    date,
    et.minimumGapMinutes ?? 0,
  );
  if (!diagnosis) return jsonError("No availability schedule is configured.", 400);

  return NextResponse.json({ diagnosis });
});
