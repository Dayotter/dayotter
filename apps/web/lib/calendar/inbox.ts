import { and, eq, getDb, gte, ne, schema } from "@calsync/db";

export interface ReconnectItem {
  connectionId: string;
  provider: string;
  account: string;
  error: string | null;
}

export interface ConflictItem {
  uid: string;
  title: string;
  startsAt: string;
  clashTitle: string;
}

export interface InboxData {
  /** Connections that stopped syncing and need re-auth. */
  reconnect: ReconnectItem[];
  /** Confirmed bookings that now overlap an external calendar event (double-booked). */
  conflicts: ConflictItem[];
}

/**
 * The Calendar Inbox aggregator — one place for scheduling actions that need
 * attention. Composes existing engines (sync health) and the unified event model
 * (double-booking detection). Pending invites + focus suggestions are lazy-loaded
 * client-side from their own endpoints.
 */
export async function inboxData(userId: string): Promise<InboxData> {
  const db = getDb();
  const now = new Date();

  const connections = await db.query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, userId),
    with: { calendars: true },
  });

  const reconnect: ReconnectItem[] = connections
    .filter((c) => c.status === "error" || c.status === "revoked")
    .map((c) => ({
      connectionId: c.id,
      provider: c.provider,
      account: c.externalAccountId,
      error: c.lastError,
    }));

  // Double-booking detection: the host's upcoming confirmed bookings that overlap
  // an opaque event on one of their conflict-checked calendars. (Availability
  // prevents this at booking time — a clash means an external event was added
  // afterwards.)
  const calendarIds = connections
    .flatMap((c) => c.calendars)
    .filter((cal) => cal.checkForConflicts)
    .map((cal) => cal.id);

  const conflicts: ConflictItem[] = [];
  if (calendarIds.length > 0) {
    const [bookings, events] = await Promise.all([
      db.query.bookings.findMany({
        where: and(
          eq(schema.bookings.hostId, userId),
          eq(schema.bookings.status, "confirmed"),
          gte(schema.bookings.startsAt, now),
        ),
        columns: { uid: true, title: true, startsAt: true, endsAt: true },
        limit: 100,
      }),
      db.query.calendarEvents.findMany({
        where: and(
          gte(schema.calendarEvents.endsAt, now),
          ne(schema.calendarEvents.transparency, "transparent"),
        ),
        columns: { calendarId: true, title: true, startsAt: true, endsAt: true },
        limit: 500,
      }),
    ]);
    const calSet = new Set(calendarIds);
    const relevant = events.filter((e) => calSet.has(e.calendarId));
    for (const b of bookings) {
      const clash = relevant.find((e) => e.startsAt < b.endsAt && e.endsAt > b.startsAt);
      if (clash) {
        conflicts.push({
          uid: b.uid,
          title: b.title,
          startsAt: b.startsAt.toISOString(),
          clashTitle: clash.title ?? "an event on your calendar",
        });
      }
    }
  }

  return { reconnect, conflicts };
}
