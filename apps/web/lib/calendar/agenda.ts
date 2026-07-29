import { and, asc, eq, getDb, gte, inArray, lt, ne, schema } from "@dayotter/db";

/**
 * One item on the host's real agenda - either a DayOtter booking or a busy event
 * synced from a connected (Google / Microsoft / Apple) calendar. This is what the
 * calendar views AND the AI assistant should both see: a booking page that only
 * knows its own bookings is blind to the meetings on the host's actual calendar.
 */
export interface AgendaItem {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** "booking" = a DayOtter booking (actionable); "external" = a synced calendar event (read-only). */
  source: "booking" | "external";
  attendees: string[];
  /** Public booking id (only for `source: "booking"`), so it can be acted on. */
  uid?: string;
}

/**
 * Busy, non-all-day events synced from the host's conflict-checked calendars in
 * [from, to). Mirrors of DayOtter bookings we wrote to the calendar are excluded
 * (by external id) so a booking never shows up twice. Shared by the calendar
 * range API and the AI agenda so the two can never drift.
 */
export async function syncedExternalEvents(
  userId: string,
  from: Date,
  to: Date,
  limit = 500,
): Promise<{ title: string; startsAt: Date; endsAt: Date }[]> {
  const db = getDb();
  const conns = await db.query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, userId),
    with: { calendars: { columns: { id: true, checkForConflicts: true } } },
  });
  const calIds = conns
    .flatMap((c) => c.calendars)
    .filter((c) => c.checkForConflicts)
    .map((c) => c.id);
  if (calIds.length === 0) return [];

  const refs = await db.query.bookingReferences.findMany({
    where: inArray(schema.bookingReferences.calendarId, calIds),
    columns: { externalEventId: true },
  });
  const mirrorIds = new Set(refs.map((r) => r.externalEventId));

  const rows = await db.query.calendarEvents.findMany({
    where: and(
      inArray(schema.calendarEvents.calendarId, calIds),
      gte(schema.calendarEvents.endsAt, from),
      lt(schema.calendarEvents.startsAt, to),
      ne(schema.calendarEvents.transparency, "transparent"),
      eq(schema.calendarEvents.allDay, false),
    ),
    columns: { title: true, startsAt: true, endsAt: true, externalEventId: true },
    orderBy: asc(schema.calendarEvents.startsAt),
    limit,
  });
  return rows
    .filter((e) => !mirrorIds.has(e.externalEventId))
    .map((e) => ({ title: e.title ?? "Busy", startsAt: e.startsAt, endsAt: e.endsAt }));
}

/**
 * Merge DayOtter bookings and synced external events into one chronological,
 * source-tagged agenda, capped at `limit`. Pure (no I/O) so it can be unit-tested.
 */
export function mergeAgenda(
  bookings: { title: string; startsAt: Date; endsAt: Date; uid: string; attendees: string[] }[],
  external: { title: string; startsAt: Date; endsAt: Date }[],
  limit: number,
): AgendaItem[] {
  const items: AgendaItem[] = [
    ...bookings.map((b) => ({
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      source: "booking" as const,
      attendees: b.attendees,
      uid: b.uid,
    })),
    ...external.map((e) => ({
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      source: "external" as const,
      attendees: [],
    })),
  ];
  items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return items.slice(0, limit);
}

/**
 * The host's real agenda over [from, to): DayOtter bookings + synced external
 * calendar events, merged chronologically and capped. This is the source of
 * truth for "what's on my calendar / how busy am I / when's my next meeting".
 */
export async function getAgenda(
  userId: string,
  from: Date,
  to: Date,
  limit = 50,
): Promise<AgendaItem[]> {
  const db = getDb();
  const [bookings, external] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        ne(schema.bookings.status, "cancelled"),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
      orderBy: asc(schema.bookings.startsAt),
      limit,
      with: { attendees: { columns: { name: true, email: true } } },
    }),
    syncedExternalEvents(userId, from, to, limit),
  ]);

  return mergeAgenda(
    bookings.map((b) => ({
      title: b.title,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      uid: b.uid,
      attendees: b.attendees.map((a) => a.name ?? a.email),
    })),
    external,
    limit,
  );
}
