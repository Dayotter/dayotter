import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, inArray, lt, ne, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Bookings for the host within [start, end) - powers the calendar views.
 * Cancelled bookings are excluded. Colour comes from the event type.
 */
export const GET = withUser(async (u, request) => {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return jsonError("Invalid range", 400);
  }
  // Guard against unbounded ranges (max ~100 days).
  if (end.getTime() - start.getTime() > 100 * 24 * 60 * 60_000) {
    return jsonError("Range too large", 400);
  }

  const rows = await getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, u.id),
      ne(schema.bookings.status, "cancelled"),
      gte(schema.bookings.startsAt, start),
      lt(schema.bookings.startsAt, end),
    ),
    orderBy: asc(schema.bookings.startsAt),
    with: {
      attendees: { columns: { name: true, email: true } },
      eventType: { columns: { color: true } },
    },
  });

  // Also surface the host's real (synced) calendar events, so the calendar shows
  // their whole schedule - not just DayOtter bookings. Busy, non-all-day only.
  const conns = await getDb().query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, u.id),
    with: { calendars: { columns: { id: true, checkForConflicts: true } } },
  });
  const calIds = conns
    .flatMap((c) => c.calendars)
    .filter((c) => c.checkForConflicts)
    .map((c) => c.id);

  let events: { title: string; startsAt: string; endsAt: string }[] = [];
  if (calIds.length > 0) {
    // A DayOtter booking we write to the host's calendar syncs back as an event.
    // Exclude those mirrors by their external id so a booking doesn't appear
    // twice (once as a booking, once as a synced event) in the calendar view.
    const refs = await getDb().query.bookingReferences.findMany({
      where: inArray(schema.bookingReferences.calendarId, calIds),
      columns: { externalEventId: true },
    });
    const mirrorIds = new Set(refs.map((r) => r.externalEventId));

    const evRows = await getDb().query.calendarEvents.findMany({
      where: and(
        inArray(schema.calendarEvents.calendarId, calIds),
        gte(schema.calendarEvents.endsAt, start),
        lt(schema.calendarEvents.startsAt, end),
        ne(schema.calendarEvents.transparency, "transparent"),
        eq(schema.calendarEvents.allDay, false),
      ),
      columns: { title: true, startsAt: true, endsAt: true, externalEventId: true },
      // Deterministic order so the 500-row cap keeps the EARLIEST events, not an
      // arbitrary slice, when a host has a very dense window.
      orderBy: asc(schema.calendarEvents.startsAt),
      limit: 500,
    });
    events = evRows
      .filter((e) => !mirrorIds.has(e.externalEventId))
      .map((e) => ({
        title: e.title ?? "Busy",
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
      }));
  }

  return NextResponse.json({
    bookings: rows.map((b) => ({
      uid: b.uid,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status,
      color: b.eventType?.color ?? null,
      attendees: b.attendees.map((a) => a.name ?? a.email),
    })),
    events,
  });
});
