import { and, eq, getDb, gte, inArray, lte, schema } from "@calsync/db";

export interface BusyInterval {
  start: Date;
  end: Date;
  /** A calSync booking title, or undefined for an external calendar block. */
  title?: string;
}

export interface MemberSchedule {
  userId: string;
  name: string;
  email: string;
  intervals: BusyInterval[];
}

/**
 * The combined busy schedule for a set of team members over a window — the data
 * behind the shared team calendar. Merges each member's calSync bookings (they
 * host) with their connected calendars' busy blocks, so you can see when the
 * whole team is occupied. Privacy-preserving: external blocks carry no title.
 */
export async function teamSchedule(
  members: { userId: string; name: string; email: string }[],
  rangeStart: Date,
  rangeEnd: Date,
): Promise<MemberSchedule[]> {
  const db = getDb();
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return [];

  // Map each conflict-checked calendar to its owner so busy blocks attribute back.
  const connections = await db.query.calendarConnections.findMany({
    where: inArray(schema.calendarConnections.userId, memberIds),
    with: { calendars: true },
  });
  const calToUser = new Map<string, string>();
  for (const conn of connections) {
    for (const cal of conn.calendars) {
      if (cal.checkForConflicts) calToUser.set(cal.id, conn.userId);
    }
  }
  const calendarIds = [...calToUser.keys()];

  const [busyBlocks, bookings] = await Promise.all([
    calendarIds.length
      ? db.query.busyBlocks.findMany({
          where: and(
            inArray(schema.busyBlocks.calendarId, calendarIds),
            lte(schema.busyBlocks.startsAt, rangeEnd),
            gte(schema.busyBlocks.endsAt, rangeStart),
          ),
          columns: { calendarId: true, startsAt: true, endsAt: true },
        })
      : Promise.resolve([]),
    db.query.bookings.findMany({
      where: and(
        inArray(schema.bookings.hostId, memberIds),
        eq(schema.bookings.status, "confirmed"),
        lte(schema.bookings.startsAt, rangeEnd),
        gte(schema.bookings.endsAt, rangeStart),
      ),
      columns: { hostId: true, startsAt: true, endsAt: true, title: true },
    }),
  ]);

  const byUser = new Map<string, BusyInterval[]>(memberIds.map((id) => [id, []]));
  for (const b of busyBlocks) {
    const userId = calToUser.get(b.calendarId);
    if (userId) byUser.get(userId)?.push({ start: b.startsAt, end: b.endsAt });
  }
  for (const b of bookings) {
    byUser.get(b.hostId)?.push({ start: b.startsAt, end: b.endsAt, title: b.title });
  }

  return members.map((m) => ({
    ...m,
    intervals: (byUser.get(m.userId) ?? []).sort((a, b) => a.start.getTime() - b.start.getTime()),
  }));
}
