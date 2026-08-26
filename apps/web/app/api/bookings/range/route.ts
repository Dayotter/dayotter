import { syncedExternalEvents } from "@/lib/calendar/agenda";
import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, lt, ne, schema } from "@dayotter/db";
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

  const db = getDb();
  const [rows, synced, blocks] = await Promise.all([
    db.query.bookings.findMany({
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
    }),
    syncedExternalEvents(u.id, start, end),
    // Held focus / personal / travel blocks, so the calendar shows the host's
    // whole schedule - not just meetings.
    db.query.timeBlocks.findMany({
      where: and(
        eq(schema.timeBlocks.userId, u.id),
        gte(schema.timeBlocks.endsAt, start),
        lt(schema.timeBlocks.startsAt, end),
      ),
      columns: { id: true, title: true, kind: true, startsAt: true, endsAt: true },
      orderBy: asc(schema.timeBlocks.startsAt),
    }),
  ]);

  // Non-booking items the calendar shows for context: synced external "busy"
  // events + the host's own held blocks, each tagged with a category for colour.
  const events: {
    id?: string;
    title: string;
    startsAt: string;
    endsAt: string;
    category: "busy" | "focus" | "personal" | "travel" | "unavailable";
  }[] = synced.map((e) => ({
    title: e.title,
    startsAt: e.startsAt.toISOString(),
    endsAt: e.endsAt.toISOString(),
    category: "busy" as const,
  }));
  for (const b of blocks) {
    events.push({
      id: `time-block:${b.id}`,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      category:
        b.kind === "focus"
          ? "focus"
          : b.kind === "personal"
            ? "personal"
            : b.kind === "travel"
              ? "travel"
              : "unavailable",
    });
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
