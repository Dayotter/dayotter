import { and, desc, eq, getDb, gte, inArray, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import type { MemoryExtractor, MemoryFact } from "./types";

/** Window of history each extractor learns from. */
const LOOKBACK_DAYS = 90;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Load the user's recent host bookings once, shared across extractors. */
async function recentBookings(userId: string) {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000);
  return getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, userId),
      inArray(schema.bookings.status, ["confirmed", "completed"]),
      gte(schema.bookings.startsAt, since),
    ),
    orderBy: desc(schema.bookings.startsAt),
    columns: { id: true, startsAt: true, endsAt: true, timezone: true },
    with: { attendees: { columns: { name: true, email: true } } },
  });
}
type RecentBooking = Awaited<ReturnType<typeof recentBookings>>[number];

function mode<T>(items: T[]): { value: T; share: number } | null {
  if (items.length === 0) return null;
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) (best = k), (bestN = n);
  return best === null ? null : { value: best, share: bestN / items.length };
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Join names naturally: "Dana", "Dana and Priya", "Dana, Priya and Sam". */
function naturalList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * The built-in extractors. Each derives one fact from a user's history. To teach
 * Otter something new, add an extractor here — nothing else needs to change.
 * Keep them cheap (they run on refresh) and honest: only claim a pattern when
 * it's a *clear* one, so Otter never states something wobbly as fact.
 */
export const EXTRACTORS: MemoryExtractor[] = [
  // How long the user's meetings usually run — only when it's genuinely typical.
  {
    key: "typical_duration",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      if (rows.length < 4) return null;
      const durations = rows.map((b) =>
        Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000),
      );
      const m = mode(durations);
      // Don't claim a "usual" length when meetings are all over the place.
      if (!m || m.share < 0.5) return null;
      return {
        kind: "pattern",
        key: "typical_duration",
        value: { minutes: m.value, share: m.share },
        label: `Meetings are usually ${m.value} minutes`,
        confidence: Math.min(0.9, 0.5 + m.share / 2),
      };
    },
  },

  // The people the user meets with most.
  {
    key: "frequent_contacts",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      const counts = new Map<string, { name: string; count: number }>();
      for (const b of rows) {
        for (const a of b.attendees) {
          const key = a.email.toLowerCase();
          const prev = counts.get(key);
          counts.set(key, { name: a.name || a.email, count: (prev?.count ?? 0) + 1 });
        }
      }
      const top = [...counts.values()]
        .filter((c) => c.count >= 2)
        .sort((a, b) => b.count - a.count);
      if (top.length === 0) return null;
      const label = `Meets often with ${naturalList(top.slice(0, 3).map((c) => c.name))}`;
      return {
        kind: "contact",
        key: "frequent_contacts",
        value: top.slice(0, 5),
        label,
        confidence: Math.min(0.85, 0.55 + top[0]!.count / 20),
      };
    },
  },

  // The part of the day the user takes most meetings — only if it clearly leans.
  {
    key: "active_hours",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      if (rows.length < 5) return null;
      const buckets = { morning: 0, afternoon: 0, evening: 0 };
      for (const b of rows) {
        const h = DateTime.fromJSDate(b.startsAt).setZone(b.timezone).hour;
        if (h < 12) buckets.morning++;
        else if (h < 17) buckets.afternoon++;
        else buckets.evening++;
      }
      const entries = (Object.entries(buckets) as [keyof typeof buckets, number][]).sort(
        (a, b) => b[1] - a[1],
      );
      const [topLabel, topN] = entries[0]!;
      const share = topN / rows.length;
      if (share < 0.5) return null; // no clear lean — don't guess
      return {
        kind: "pattern",
        key: "active_hours",
        value: { ...buckets, lean: topLabel, share },
        label: `Prefers meetings in the ${topLabel}`,
        confidence: Math.min(0.8, 0.4 + share / 2),
      };
    },
  },

  // The weekday the user meets most — helps Otter avoid piling onto a busy day.
  {
    key: "busiest_weekday",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      if (rows.length < 6) return null;
      const byDay = new Array(7).fill(0);
      for (const b of rows)
        byDay[DateTime.fromJSDate(b.startsAt).setZone(b.timezone).weekday % 7]++;
      const max = Math.max(...byDay);
      const day = byDay.indexOf(max);
      if (max / rows.length < 0.3) return null; // spread evenly — no standout
      return {
        kind: "pattern",
        key: "busiest_weekday",
        value: { weekday: day, count: max },
        label: `${WEEKDAYS[day]}s are usually the busiest`,
        confidence: 0.6,
      };
    },
  },

  // Roughly how loaded the user's week is.
  {
    key: "meeting_load",
    async extract(userId): Promise<MemoryFact | null> {
      const rows: RecentBooking[] = await recentBookings(userId);
      if (rows.length < 5) return null;
      const perWeek = Math.round((rows.length / LOOKBACK_DAYS) * 7);
      if (perWeek < 1) return null;
      return {
        kind: "pattern",
        key: "meeting_load",
        value: { perWeek, sample: rows.length },
        label: `Books about ${plural(perWeek, "meeting")} a week`,
        confidence: 0.6,
      };
    },
  },
];
