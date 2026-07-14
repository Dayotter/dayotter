import { DateTime } from "luxon";

export interface Interval {
  start: Date;
  end: Date;
}

export interface RankOptions {
  /** Host schedule timezone - time-of-day scoring is done in local time. */
  timezone: string;
  now: Date;
  /** Minimum gap the host keeps around their own meetings (minutes). */
  gapMinutes?: number;
  /** Preferred meeting hour (local, 0–24; may be fractional). Default late morning. */
  preferredHour?: number;
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Local hour-of-day (fractional) for a slot in the host's timezone. */
function localHour(date: Date, timezone: string): number {
  const dt = DateTime.fromJSDate(date).setZone(timezone);
  return dt.hour + dt.minute / 60;
}

/** Local calendar-day key (YYYY-MM-DD) in the host's timezone. */
export function localDay(date: Date, timezone: string): string {
  return DateTime.fromJSDate(date).setZone(timezone).toISODate() ?? "";
}

/**
 * Score one bookable slot for "smart scheduling". Higher is better. The intent is
 * to recommend times that keep the host's day tidy rather than just the earliest
 * opening. Signals (all deterministic - no LLM):
 *  - Consolidation: a slot back-to-back with an existing commitment (respecting
 *    the host's gap) scores highest; it grows a contiguous busy block and so
 *    protects the host's remaining focus time. Near-but-not-adjacent gives a
 *    smaller bonus.
 *  - Time-of-day fit: a soft preference for the host's preferred hour.
 *  - Sooner: a mild nudge toward earlier dates so recommendations feel prompt.
 */
export function scoreSlot(slot: Interval, commitments: Interval[], opts: RankOptions): number {
  const gapMs = (opts.gapMinutes ?? 0) * MINUTE;
  const tolerance = gapMs + MINUTE; // "adjacent" allows for the enforced gap + rounding

  let adjacency = 0;
  for (const c of commitments) {
    // Slot immediately after a commitment, or immediately before one.
    const afterGap = slot.start.getTime() - c.end.getTime();
    const beforeGap = c.start.getTime() - slot.end.getTime();
    if ((afterGap >= 0 && afterGap <= tolerance) || (beforeGap >= 0 && beforeGap <= tolerance)) {
      adjacency = Math.max(adjacency, 100);
      continue;
    }
    // Same-ish part of the day (within 2h of a commitment) - mild consolidation.
    const near = Math.min(Math.abs(afterGap), Math.abs(beforeGap));
    if (near <= 2 * HOUR) adjacency = Math.max(adjacency, 30 * (1 - near / (2 * HOUR)));
  }

  const ph = opts.preferredHour ?? 10.5;
  const hour = localHour(slot.start, opts.timezone);
  const timeOfDay = 40 * Math.exp(-((hour - ph) ** 2) / (2 * 2.5 ** 2));

  const daysOut = Math.max(0, (slot.start.getTime() - opts.now.getTime()) / DAY);
  const soon = Math.max(0, 8 - daysOut);

  return adjacency + timeOfDay + soon;
}

/**
 * Pick the top `max` recommended slots, spread across distinct days so the booker
 * sees variety rather than three openings in one morning. Returns them in
 * chronological order. Ties break toward the earlier slot.
 */
export function recommendedSlots(
  slots: Interval[],
  commitments: Interval[],
  opts: RankOptions & { max?: number },
): Interval[] {
  const max = opts.max ?? 3;
  if (slots.length === 0) return [];

  const scored = slots
    .map((slot) => ({ slot, score: scoreSlot(slot, commitments, opts) }))
    .sort((a, b) => b.score - a.score || a.slot.start.getTime() - b.slot.start.getTime());

  const chosen: Interval[] = [];
  const usedDays = new Set<string>();
  // First pass: at most one per day, best-first.
  for (const { slot } of scored) {
    if (chosen.length >= max) break;
    const day = localDay(slot.start, opts.timezone);
    if (usedDays.has(day)) continue;
    usedDays.add(day);
    chosen.push(slot);
  }
  // Second pass: if fewer than `max` distinct days exist, fill with next-best.
  if (chosen.length < max) {
    for (const { slot } of scored) {
      if (chosen.length >= max) break;
      if (!chosen.includes(slot)) chosen.push(slot);
    }
  }

  return chosen.sort((a, b) => a.start.getTime() - b.start.getTime());
}
