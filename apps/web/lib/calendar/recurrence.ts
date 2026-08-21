import { DateTime } from "luxon";

/**
 * Pure generator for a weekly-recurring series of time blocks. Otter uses this to
 * turn "hold lunch 12-1 every weekday" or "block Friday afternoons every week"
 * into concrete occurrences it can insert as a `timeBlocks` series (one shared
 * seriesId), so the whole series can later be shown as one row and deleted
 * together via delete_focus_block(series: true).
 *
 * Timezone-correct: local start times are resolved in the host's zone (so a
 * 12:00 hold stays at local noon across DST), then converted to UTC instants.
 * No I/O - trivially unit-testable.
 */

export interface RecurrenceSpec {
  /** Weekdays to place a block on: 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  /** Local start time, "HH:MM" 24h. */
  start: string;
  durationMinutes: number;
  /** How many weeks ahead to materialize the series. */
  weeks: number;
  timezone: string;
}

export interface Occurrence {
  startsAt: Date;
  endsAt: Date;
}

/**
 * Materialize the series over [from, from + weeks·7 days). Occurrences whose
 * start is at or before `from` (already past) are skipped, and the total is
 * capped at `maxOccurrences` so a broad request can't create a runaway series.
 */
/** How an Otter create repeats. See seriesOccurrences. */
export type RecurrenceFreq = "none" | "daily" | "weekdays" | "weekly" | "consecutive";

/**
 * Materialize the concrete occurrences for an Otter recurring create, given the
 * first instant and a repetition descriptor. "consecutive" places back-to-back
 * same-day slots (three interviews at 2:00 / 2:15 / 2:30); the across-day
 * frequencies reuse the timezone-correct weekly grid so a 9am standup stays at
 * local 9am across DST. The first occurrence is always `start`. Total is clamped
 * to [1, 60]. Pure - no I/O.
 */
export function seriesOccurrences(params: {
  start: Date;
  durationMinutes: number;
  freq: RecurrenceFreq;
  daysOfWeek: number[];
  count: number;
  timezone: string;
}): Occurrence[] {
  const { start, durationMinutes, freq, count, timezone } = params;
  const total = Math.max(1, Math.min(Math.trunc(count) || 1, 60));
  const single: Occurrence = {
    startsAt: start,
    endsAt: new Date(start.getTime() + durationMinutes * 60_000),
  };
  if (freq === "none" || total === 1) return [single];

  if (freq === "consecutive") {
    const out: Occurrence[] = [];
    for (let i = 0; i < total; i++) {
      const s = new Date(start.getTime() + i * durationMinutes * 60_000);
      out.push({ startsAt: s, endsAt: new Date(s.getTime() + durationMinutes * 60_000) });
    }
    return out;
  }

  const startDt = DateTime.fromJSDate(start, { zone: timezone });
  const hhmm = startDt.toFormat("HH:mm");
  const days =
    freq === "daily"
      ? [0, 1, 2, 3, 4, 5, 6]
      : freq === "weekdays"
        ? [1, 2, 3, 4, 5]
        : params.daysOfWeek.length > 0
          ? params.daysOfWeek
          : [startDt.weekday % 7]; // weekly with no explicit day → the start's weekday
  // Look from just before `start` so the first occurrence (== start) is kept.
  return recurringBlockOccurrences(
    { daysOfWeek: days, start: hhmm, durationMinutes, weeks: 52, timezone },
    new Date(start.getTime() - 1000),
    total,
  );
}

export function recurringBlockOccurrences(
  spec: RecurrenceSpec,
  from: Date,
  maxOccurrences = 60,
): Occurrence[] {
  const [h, m] = spec.start.split(":").map((n) => Number.parseInt(n, 10));
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) return [];
  const days = new Set(spec.daysOfWeek);
  const startDay = DateTime.fromJSDate(from, { zone: spec.timezone }).startOf("day");
  const totalDays = Math.max(0, Math.min(spec.weeks, 52)) * 7;

  const out: Occurrence[] = [];
  for (let d = 0; d < totalDays && out.length < maxOccurrences; d++) {
    const day = startDay.plus({ days: d });
    // Luxon weekday is 1=Mon…7=Sun; %7 maps to 0=Sun…6=Sat (matches the schema).
    if (!days.has(day.weekday % 7)) continue;
    const s = day.set({ hour: h, minute: m, second: 0, millisecond: 0 });
    if (s.toMillis() <= from.getTime()) continue; // don't hold time in the past
    out.push({
      startsAt: s.toJSDate(),
      endsAt: s.plus({ minutes: spec.durationMinutes }).toJSDate(),
    });
  }
  return out;
}
