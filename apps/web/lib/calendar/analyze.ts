import { DateTime } from "luxon";

/**
 * Pure schedule analytics over a set of calendar commitments. The AI's read
 * tools return raw agenda items; this turns them into the aggregate answers
 * people actually ask for - "how many hours of meetings this week?", "when do I
 * finish today?", "am I double-booked?", "what's my longest free stretch?" -
 * instead of leaving the model to hand-count JSON (which it does unreliably).
 *
 * No I/O: the caller fetches the items (bookings + synced events + focus blocks)
 * and hands them in, so this is trivially unit-testable and timezone-correct.
 */

export interface BusyItem {
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** "booking" | "external" | "focus" | "personal" | ... - for a per-source breakdown. */
  source: string;
}

export interface ScheduleConflict {
  a: string;
  b: string;
  startsAt: string;
  endsAt: string;
}

export interface ScheduleAnalysis {
  fromISO: string;
  toISO: string;
  commitmentCount: number;
  bySource: Record<string, number>;
  /** Total busy time with overlaps merged (so double-booked time isn't counted twice). */
  busyHours: number;
  busiestDay: { date: string; hours: number } | null;
  /** First commitment start and last commitment end in the window (the "finish time"). */
  firstStartISO: string | null;
  lastEndISO: string | null;
  /** Largest gap between consecutive commitments (ignores working hours - a raw calendar gap). */
  longestGapMinutes: number | null;
  longestGapFromISO: string | null;
  longestGapToISO: string | null;
  /** Overlapping pairs - the host is double-booked across these (capped). */
  conflicts: ScheduleConflict[];
}

/** Clamp [s,e) to [from,to); returns null if they don't overlap. */
function clampInterval(s: Date, e: Date, from: Date, to: Date): [number, number] | null {
  const start = Math.max(s.getTime(), from.getTime());
  const end = Math.min(e.getTime(), to.getTime());
  return end > start ? [start, end] : null;
}

/** Merge sorted [start,end] ms intervals; returns total covered minutes + merged spans. */
function mergeMinutes(intervals: [number, number][]): {
  minutes: number;
  merged: [number, number][];
} {
  if (intervals.length === 0) return { minutes: 0, merged: [] };
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0]!];
  for (const [s, e] of sorted.slice(1)) {
    const last = merged[merged.length - 1]!;
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const minutes = merged.reduce((sum, [s, e]) => sum + (e - s) / 60_000, 0);
  return { minutes, merged };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Analyze the host's commitments in [from, to). `timezone` is used for per-day
 * bucketing so "busiest day" reflects the host's local calendar, not UTC.
 */
export function analyzeSchedule(
  items: BusyItem[],
  from: Date,
  to: Date,
  timezone: string,
): ScheduleAnalysis {
  // Keep only items that actually intersect the window, chronological.
  const inWindow = items
    .filter((it) => it.endsAt > from && it.startsAt < to)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const bySource: Record<string, number> = {};
  for (const it of inWindow) bySource[it.source] = (bySource[it.source] ?? 0) + 1;

  // Busy minutes (overlaps merged), clamped to the window.
  const clamped = inWindow
    .map((it) => clampInterval(it.startsAt, it.endsAt, from, to))
    .filter((x): x is [number, number] => x !== null);
  const { minutes: busyMinutes } = mergeMinutes(clamped);

  // Per-day busy hours in the host's timezone (split intervals at local midnight).
  const perDay = new Map<string, number>();
  for (const [s, e] of clamped) {
    let cursor = DateTime.fromMillis(s, { zone: timezone });
    const end = DateTime.fromMillis(e, { zone: timezone });
    while (cursor < end) {
      const dayEnd = cursor.plus({ days: 1 }).startOf("day");
      const chunkEnd = dayEnd < end ? dayEnd : end;
      const mins = chunkEnd.diff(cursor, "minutes").minutes;
      const key = cursor.toISODate() ?? "";
      perDay.set(key, (perDay.get(key) ?? 0) + mins);
      cursor = chunkEnd;
    }
  }
  let busiestDay: ScheduleAnalysis["busiestDay"] = null;
  for (const [date, mins] of perDay) {
    if (!busiestDay || mins > busiestDay.hours * 60)
      busiestDay = { date, hours: round1(mins / 60) };
  }

  // Largest gap between consecutive commitments (using merged busy spans).
  const { merged } = mergeMinutes(clamped);
  let longestGapMinutes: number | null = null;
  let longestGapFromISO: string | null = null;
  let longestGapToISO: string | null = null;
  for (let i = 1; i < merged.length; i++) {
    const gap = (merged[i]![0] - merged[i - 1]![1]) / 60_000;
    if (longestGapMinutes === null || gap > longestGapMinutes) {
      longestGapMinutes = gap;
      longestGapFromISO = new Date(merged[i - 1]![1]).toISOString();
      longestGapToISO = new Date(merged[i]![0]).toISOString();
    }
  }

  // Conflicts: overlapping pairs (pre-merge). O(n^2) is fine for a bounded window.
  const conflicts: ScheduleConflict[] = [];
  for (let i = 0; i < inWindow.length && conflicts.length < 10; i++) {
    for (let j = i + 1; j < inWindow.length && conflicts.length < 10; j++) {
      const a = inWindow[i]!;
      const b = inWindow[j]!;
      if (b.startsAt >= a.endsAt) break; // sorted by start: no later item can overlap a
      if (a.startsAt < b.endsAt && b.startsAt < a.endsAt) {
        conflicts.push({
          a: a.title,
          b: b.title,
          startsAt: new Date(Math.max(a.startsAt.getTime(), b.startsAt.getTime())).toISOString(),
          endsAt: new Date(Math.min(a.endsAt.getTime(), b.endsAt.getTime())).toISOString(),
        });
      }
    }
  }

  return {
    fromISO: from.toISOString(),
    toISO: to.toISOString(),
    commitmentCount: inWindow.length,
    bySource,
    busyHours: round1(busyMinutes / 60),
    busiestDay,
    firstStartISO: inWindow[0]?.startsAt.toISOString() ?? null,
    lastEndISO:
      inWindow.length > 0
        ? new Date(Math.max(...inWindow.map((it) => it.endsAt.getTime()))).toISOString()
        : null,
    longestGapMinutes: longestGapMinutes === null ? null : Math.round(longestGapMinutes),
    longestGapFromISO,
    longestGapToISO,
    conflicts,
  };
}
