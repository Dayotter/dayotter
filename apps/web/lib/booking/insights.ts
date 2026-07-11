import { and, eq, getDb, gte, lt, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import { type FocusMetrics, computeFocusMetrics } from "./focus-insights";

export interface InsightsData {
  /** Confirmed meetings in the next 30 days. */
  upcomingCount: number;
  /** Total booked minutes over the last 30 days. */
  bookedMinutes: number;
  /** Busiest weekday over the last 30 days (0=Sun..6=Sat), or null if no history. */
  busiestWeekday: number | null;
  /** Rounded meetings/week over the last 30 days. */
  avgPerWeek: number;
  /** Meetings scheduled in the current week. */
  thisWeek: number;
  /** Per-weekday meeting counts (index 0=Sun..6=Sat) over the last 30 days. */
  weekday: number[];
  /** Booked time grouped by event type over the last 30 days (top 6). */
  byType: { title: string; color: string | null; minutes: number }[];
  /** Deep-work / fragmentation metrics over the last 30 days. */
  focus: FocusMetrics;
}

/**
 * Compute scheduling-scoped time insights for a host over [-30d, +30d].
 * Shared by the web insights page and the mobile insights API — one source of
 * truth so both surfaces always agree.
 */
export async function computeInsights(params: {
  userId: string;
  tz: string;
  now?: Date;
}): Promise<InsightsData> {
  const now = DateTime.fromJSDate(params.now ?? new Date()).setZone(params.tz);
  const from = now.minus({ days: 30 }).toJSDate();
  const to = now.plus({ days: 30 }).toJSDate();

  const rows = await getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, params.userId),
      eq(schema.bookings.status, "confirmed"),
      gte(schema.bookings.startsAt, from),
      lt(schema.bookings.startsAt, to),
    ),
    with: { eventType: { columns: { title: true, color: true } } },
  });

  const nowMs = now.toMillis();
  const past30 = rows.filter((b) => b.startsAt.getTime() < nowMs);
  const next30 = rows.filter((b) => b.startsAt.getTime() >= nowMs);
  const minutesFor = (b: (typeof rows)[number]) =>
    (b.endsAt.getTime() - b.startsAt.getTime()) / 60_000;

  const weekday = new Array(7).fill(0);
  for (const b of past30) weekday[DateTime.fromJSDate(b.startsAt).setZone(params.tz).weekday % 7]++;
  const busiestWeekday = past30.length > 0 ? weekday.indexOf(Math.max(...weekday)) : null;

  const weekStart = now.startOf("week").toMillis();
  const weekEnd = now.endOf("week").toMillis();
  const thisWeek = rows.filter(
    (b) => b.startsAt.getTime() >= weekStart && b.startsAt.getTime() <= weekEnd,
  ).length;

  const byTypeMap = new Map<string, { title: string; color: string | null; minutes: number }>();
  for (const b of past30) {
    const title = b.eventType?.title ?? b.title;
    const cur = byTypeMap.get(title) ?? { title, color: b.eventType?.color ?? null, minutes: 0 };
    cur.minutes += minutesFor(b);
    byTypeMap.set(title, cur);
  }

  return {
    upcomingCount: next30.length,
    bookedMinutes: past30.reduce((s, b) => s + minutesFor(b), 0),
    busiestWeekday,
    avgPerWeek: Math.round((past30.length / 30) * 7),
    thisWeek,
    weekday,
    byType: [...byTypeMap.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 6),
    focus: computeFocusMetrics(
      past30.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      params.tz,
    ),
  };
}
