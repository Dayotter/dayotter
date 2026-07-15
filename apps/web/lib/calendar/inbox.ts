import { and, eq, getDb, gte, inArray, ne, schema } from "@dayotter/db";

/** Two IANA zones that are really the same place (e.g. Asia/Calcutta == Asia/Kolkata). */
function sameZone(a: string, b: string): boolean {
  if (a === b) return true;
  const canon = (tz: string) => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions().timeZone;
    } catch {
      return tz;
    }
  };
  return canon(a) === canon(b);
}

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

export interface DuplicateItem {
  title: string;
  startsAt: string;
  /** The distinct calendars the same event appears on (double-blocking time). */
  calendars: string[];
}

export interface TimezoneItem {
  calendarName: string;
  calendarTz: string;
  userTz: string;
}

export interface InboxData {
  /** Connections that stopped syncing and need re-auth. */
  reconnect: ReconnectItem[];
  /** Confirmed bookings that now overlap an external calendar event (double-booked). */
  conflicts: ConflictItem[];
  /** The same meeting synced onto 2+ calendars - blocks time twice over. */
  duplicates: DuplicateItem[];
  /** Booking write-target calendar whose timezone differs from the host's. */
  timezoneMismatches: TimezoneItem[];
}

/** Normalize a title for duplicate matching: trim, collapse whitespace, lowercase. */
function normalizeTitle(title: string | null): string {
  return (title ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Find the same meeting synced onto 2+ distinct calendars. Matches on
 * normalized title + exact start instant; untitled busy blocks are skipped
 * (too noisy). Pure - unit-tested. Capped at 10 items.
 */
export function detectDuplicates(
  events: { calendarId: string; title: string | null; startsAt: Date }[],
  calName: Map<string, string>,
): DuplicateItem[] {
  const byKey = new Map<string, { title: string; startsAt: Date; calIds: Set<string> }>();
  for (const e of events) {
    const t = normalizeTitle(e.title);
    if (!t) continue;
    const key = `${t}@${e.startsAt.getTime()}`;
    const hit = byKey.get(key);
    if (hit) hit.calIds.add(e.calendarId);
    else
      byKey.set(key, {
        title: e.title ?? "",
        startsAt: e.startsAt,
        calIds: new Set([e.calendarId]),
      });
  }
  const out: DuplicateItem[] = [];
  for (const { title, startsAt, calIds } of byKey.values()) {
    if (calIds.size < 2) continue;
    out.push({
      title,
      startsAt: startsAt.toISOString(),
      calendars: [...calIds].map((id) => calName.get(id) ?? "a calendar"),
    });
    if (out.length >= 10) break;
  }
  return out;
}

/**
 * The Calendar Inbox aggregator - one place for scheduling actions that need
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
  // prevents this at booking time - a clash means an external event was added
  // afterwards.)
  const conflictCals = connections
    .flatMap((c) => c.calendars)
    .filter((cal) => cal.checkForConflicts);
  const calendarIds = conflictCals.map((cal) => cal.id);
  const calName = new Map(conflictCals.map((cal) => [cal.id, cal.name]));

  const conflicts: ConflictItem[] = [];
  const duplicates: DuplicateItem[] = [];
  if (calendarIds.length > 0) {
    const calSet = new Set(calendarIds);
    const [bookings, events, refs] = await Promise.all([
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
        // Scope to THIS user's calendars in the query - without it the 500-row
        // cap is filled from all tenants' events and the user's own can be
        // crowded out, so a real conflict goes undetected.
        where: and(
          inArray(schema.calendarEvents.calendarId, calendarIds),
          gte(schema.calendarEvents.endsAt, now),
          ne(schema.calendarEvents.transparency, "transparent"),
        ),
        columns: {
          calendarId: true,
          title: true,
          startsAt: true,
          endsAt: true,
          externalEventId: true,
        },
        limit: 500,
      }),
      db.query.bookingReferences.findMany({
        where: inArray(schema.bookingReferences.calendarId, calendarIds),
        columns: { externalEventId: true },
      }),
    ]);
    // A booking DayOtter writes to the host's calendar syncs back as an event -
    // that mirror must NOT be flagged as clashing with its own booking. Drop every
    // booking mirror from the conflict candidates (genuinely overlapping DayOtter
    // bookings are already prevented by the DB's no-overlap constraint).
    const mirrorIds = new Set(refs.map((r) => r.externalEventId));
    const relevant = events.filter(
      (e) => calSet.has(e.calendarId) && !mirrorIds.has(e.externalEventId),
    );
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

    // Duplicate detection: the same titled event (same start instant) synced onto
    // 2+ distinct calendars, so it blocks the host's time twice. Actionable -
    // uncheck "Availability" on one of the calendars.
    duplicates.push(...detectDuplicates(relevant, calName));
  }

  // Timezone health: the calendar new bookings are written to should share the
  // host's timezone, or booked events can land at an unexpected local time.
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { timezone: true },
  });
  const userTz = user?.timezone ?? null;
  const timezoneMismatches: TimezoneItem[] = [];
  if (userTz) {
    for (const cal of connections.flatMap((c) => c.calendars)) {
      if (cal.isTargetForBookings && cal.timezone && !sameZone(cal.timezone, userTz)) {
        timezoneMismatches.push({
          calendarName: cal.name,
          calendarTz: cal.timezone,
          userTz,
        });
      }
    }
  }

  return { reconnect, conflicts, duplicates, timezoneMismatches };
}
