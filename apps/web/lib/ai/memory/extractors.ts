import { and, desc, eq, gte, inArray, schema } from "@dayotter/db";
import { getDb } from "@dayotter/db";
import { DateTime } from "luxon";
import type { MemoryExtractor, MemoryFact } from "./types";

/** Window of history each extractor learns from. */
const LOOKBACK_DAYS = 90;

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

function mode<T>(items: T[]): T | null {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: T | null = null;
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) (best = k), (bestN = n);
  return best;
}

/**
 * The built-in extractors. Each derives one fact from a user's history. To teach
 * Otter something new, add an extractor here — nothing else needs to change.
 * Keep them cheap (they run on refresh) and honest (return null without signal).
 */
export const EXTRACTORS: MemoryExtractor[] = [
  // How long the user's meetings usually run.
  {
    key: "typical_duration",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      if (rows.length < 3) return null;
      const durations = rows.map((b) =>
        Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000),
      );
      const common = mode(durations);
      if (!common) return null;
      const share = durations.filter((d) => d === common).length / durations.length;
      return {
        kind: "pattern",
        key: "typical_duration",
        value: { minutes: common, share },
        label: `Usually meets for ${common} minutes`,
        confidence: Math.min(0.9, 0.4 + share / 2),
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
      const names = top.slice(0, 3).map((c) => c.name);
      return {
        kind: "contact",
        key: "frequent_contacts",
        value: top.slice(0, 5),
        label: `Often meets with ${names.join(", ")}`,
        confidence: 0.7,
      };
    },
  },

  // The part of the day the user takes most meetings (in their timezone).
  {
    key: "active_hours",
    async extract(userId): Promise<MemoryFact | null> {
      const rows = await recentBookings(userId);
      if (rows.length < 4) return null;
      const hours = rows.map((b) => DateTime.fromJSDate(b.startsAt).setZone(b.timezone).hour);
      const buckets = { morning: 0, afternoon: 0, evening: 0 };
      for (const h of hours) {
        if (h < 12) buckets.morning++;
        else if (h < 17) buckets.afternoon++;
        else buckets.evening++;
      }
      const top = (Object.entries(buckets) as [keyof typeof buckets, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0];
      if (!top || top[1] === 0) return null;
      return {
        kind: "pattern",
        key: "active_hours",
        value: buckets,
        label: `Takes most meetings in the ${top[0]}`,
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
        label: `Books about ${perWeek} meetings a week`,
        confidence: 0.6,
      };
    },
  },
];
