import { and, eq, getDb, gte, inArray, lt, ne, schema } from "@calsync/db";
import { DateTime } from "luxon";

export interface Recommendation {
  id: string;
  /** lucide icon name the UI maps to a component. */
  icon: "sun" | "layers" | "calendar-x" | "gauge" | "shield";
  title: string;
  detail: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Meeting {
  start: Date;
  end: Date;
}

/**
 * The Intelligence engine's calendar-health + habit ("Calendar Memory") analysis.
 * Looks at the host's real meeting history — BOTH calSync bookings and external
 * events from the unified event model — over the last 30 days and returns soft,
 * advisory recommendations (never hard rules; respects the confirm-first ethos).
 */
export async function getRecommendations(params: {
  userId: string;
  tz: string;
  now?: Date;
}): Promise<Recommendation[]> {
  const db = getDb();
  const now = DateTime.fromJSDate(params.now ?? new Date()).setZone(params.tz);
  const from = now.minus({ days: 30 }).toJSDate();
  const to = now.toJSDate();

  const connections = await db.query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, params.userId),
    with: { calendars: true },
  });
  const calendarIds = connections
    .flatMap((c) => c.calendars)
    .filter((cal) => cal.checkForConflicts)
    .map((cal) => cal.id);

  const [bookings, cancelled, externalEvents] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, params.userId),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
      columns: { startsAt: true, endsAt: true },
    }),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, params.userId),
        inArray(schema.bookings.status, ["cancelled", "no_show"]),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
      columns: { startsAt: true },
    }),
    calendarIds.length > 0
      ? db.query.calendarEvents.findMany({
          where: and(
            gte(schema.calendarEvents.startsAt, from),
            lt(schema.calendarEvents.startsAt, to),
            ne(schema.calendarEvents.transparency, "transparent"),
          ),
          columns: { calendarId: true, startsAt: true, endsAt: true },
        })
      : Promise.resolve([]),
  ]);

  const calSet = new Set(calendarIds);
  const meetings: Meeting[] = [
    ...bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ...externalEvents
      .filter((e) => calSet.has(e.calendarId))
      .map((e) => ({ start: e.startsAt, end: e.endsAt })),
  ].sort((a, b) => a.start.getTime() - b.start.getTime());

  const recs: Recommendation[] = [];
  const total = meetings.length;
  // Not enough history to say anything meaningful.
  if (total < 5) return recs;

  // 1. Time-of-day habit (Calendar Memory): morning vs afternoon skew.
  let morning = 0;
  for (const m of meetings) {
    const h = DateTime.fromJSDate(m.start).setZone(params.tz).hour;
    if (h < 12) morning++;
  }
  const morningPct = Math.round((morning / total) * 100);
  if (morningPct >= 65) {
    recs.push({
      id: "prefers-morning",
      icon: "sun",
      title: "You meet mostly in the mornings",
      detail: `${morningPct}% of your meetings are before noon. Consider defaulting your booking hours to mornings and protecting afternoons for focus.`,
    });
  } else if (morningPct <= 35) {
    recs.push({
      id: "prefers-afternoon",
      icon: "sun",
      title: "You meet mostly in the afternoons",
      detail: `Only ${morningPct}% of your meetings are before noon — you could protect your mornings for deep work.`,
    });
  }

  // 2. Busiest weekday overload.
  const perDay = new Array(7).fill(0);
  for (const m of meetings) perDay[DateTime.fromJSDate(m.start).setZone(params.tz).weekday % 7]++;
  const busiest = perDay.indexOf(Math.max(...perDay));
  const avgDay = total / 7;
  if (perDay[busiest] >= Math.max(4, avgDay * 1.8)) {
    recs.push({
      id: "overloaded-day",
      icon: "gauge",
      title: `${WEEKDAYS[busiest]}s are overloaded`,
      detail: `You average ${(perDay[busiest] / 4.3).toFixed(1)} meetings every ${WEEKDAYS[busiest]}. Spreading a few to lighter days would ease the crunch.`,
    });
  }

  // 3. Fragmentation: many short gaps between back-to-back meetings.
  let shortGaps = 0;
  for (let i = 1; i < meetings.length; i++) {
    const gapMin = (meetings[i]!.start.getTime() - meetings[i - 1]!.end.getTime()) / 60_000;
    if (gapMin > 0 && gapMin < 30) shortGaps++;
  }
  if (shortGaps >= 5) {
    recs.push({
      id: "fragmented",
      icon: "layers",
      title: "Your calendar is fragmented",
      detail: `You had ${shortGaps} gaps shorter than 30 minutes between meetings — too short for real focus. Batching meetings back-to-back frees longer deep-work windows.`,
    });
  }

  // 4. Cancellation / no-show rate.
  const dropRate = Math.round((cancelled.length / (total + cancelled.length)) * 100);
  if (cancelled.length >= 3 && dropRate >= 20) {
    recs.push({
      id: "high-cancellations",
      icon: "calendar-x",
      title: "A lot of bookings fall through",
      detail: `${dropRate}% of your bookings were cancelled or no-showed. A confirmation reminder — or a deposit on paid events — usually helps.`,
    });
  }

  return recs.slice(0, 4);
}
