import { DateTime } from "luxon";
import type { AvailabilityInput, BusyInterval, DateOverride, Slot, WeeklyRule } from "./types";

/** Parse "HH:mm" / "HH:mm:ss" into minutes since midnight. */
function timeToMinutes(time: string): number {
  const parts = time.split(":");
  const hours = Number(parts[0] ?? 0);
  const minutes = Number(parts[1] ?? 0);
  return hours * 60 + minutes;
}

/** An open window for a day, as epoch-millis bounds (so the inner slot loop can
 *  use plain integer math instead of allocating a Luxon DateTime per slot). */
interface DayWindow {
  start: number;
  end: number;
}

/** Resolve the concrete open windows for a single calendar day, in epoch millis.
 *  Boundaries still go through Luxon's day math so DST and wall-clock times are
 *  handled correctly; only the returned values are millis. */
function windowsForDay(day: DateTime, rules: WeeklyRule[], overrides: DateOverride[]): DayWindow[] {
  const isoDate = day.toISODate();
  const override = overrides.find((o) => o.date === isoDate);

  if (override) {
    // An override with no times means the day is fully blocked.
    if (!override.startTime || !override.endTime) return [];
    return [
      {
        start: day.plus({ minutes: timeToMinutes(override.startTime) }).toMillis(),
        end: day.plus({ minutes: timeToMinutes(override.endTime) }).toMillis(),
      },
    ];
  }

  // Luxon weekday: 1=Mon..7=Sun. Our rules use 0=Sun..6=Sat.
  const dow = day.weekday === 7 ? 0 : day.weekday;
  return rules
    .filter((r) => r.dayOfWeek === dow)
    .map((r) => ({
      start: day.plus({ minutes: timeToMinutes(r.startTime) }).toMillis(),
      end: day.plus({ minutes: timeToMinutes(r.endTime) }).toMillis(),
    }));
}

/** Does [aStart, aEnd) overlap [bStart, bEnd)? */
function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Compute bookable slots for one host given their schedule, external busy
 * times, and the event constraints. Pure and deterministic - the same inputs
 * always yield the same slots, which makes it trivial to unit-test.
 */
export function computeAvailability(input: AvailabilityInput): Slot[] {
  const { schedule, busy, event, rangeStart, rangeEnd, now } = input;

  const duration = event.durationMinutes;
  const interval = event.slotIntervalMinutes ?? duration;
  const bufferBefore = event.bufferBeforeMinutes;
  const bufferAfter = event.bufferAfterMinutes;

  // Effective lower/upper bounds as epoch millis.
  const earliest = now.getTime() + event.minimumNoticeMinutes * 60_000;
  const windowLimit =
    event.bookingWindowDays != null
      ? now.getTime() + event.bookingWindowDays * 86_400_000
      : Number.POSITIVE_INFINITY;
  const rangeStartMs = Math.max(rangeStart.getTime(), earliest);
  const rangeEndMs = Math.min(rangeEnd.getTime(), windowLimit);
  if (rangeStartMs >= rangeEndMs) return [];

  // Pre-sort busy intervals as epoch-millis pairs for fast overlap checks.
  const busyMs = busy
    .map((b: BusyInterval) => ({ start: b.start.getTime(), end: b.end.getTime() }))
    .sort((a, b) => a.start - b.start);

  const conflictsWithBusy = (slotStart: number, slotEnd: number): boolean => {
    const guardedStart = slotStart - bufferBefore * 60_000;
    const guardedEnd = slotEnd + bufferAfter * 60_000;
    for (const b of busyMs) {
      if (b.start >= guardedEnd) break; // sorted: no later interval can overlap
      if (overlaps(guardedStart, guardedEnd, b.start, b.end)) return true;
    }
    return false;
  };

  const slots: Slot[] = [];
  const durationMs = duration * 60_000;
  const intervalMs = interval * 60_000;

  // Iterate day-by-day in the schedule's timezone so DST is handled correctly.
  // The day/window boundaries use Luxon (DST-aware); the inner slot loop is plain
  // integer millisecond arithmetic - equivalent to Luxon's minute stepping, but
  // without allocating a DateTime per candidate slot.
  let cursor = DateTime.fromMillis(rangeStartMs, { zone: schedule.timezone }).startOf("day");
  const lastDay = DateTime.fromMillis(rangeEndMs, { zone: schedule.timezone }).endOf("day");

  while (cursor <= lastDay) {
    for (const win of windowsForDay(cursor, schedule.rules, schedule.overrides)) {
      for (let startMs = win.start; startMs + durationMs <= win.end; startMs += intervalMs) {
        const endMs = startMs + durationMs;
        if (
          startMs >= earliest &&
          startMs >= rangeStartMs &&
          startMs < rangeEndMs &&
          !conflictsWithBusy(startMs, endMs)
        ) {
          slots.push({ start: new Date(startMs), end: new Date(endMs) });
        }
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return slots.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Intersect multiple hosts' free slots - the basis for collective team
 * scheduling ("find a time when we're all free"). Returns slots present for
 * every host (matched by start instant).
 */
export function intersectAvailability(slotsByHost: Slot[][]): Slot[] {
  if (slotsByHost.length === 0) return [];
  const [first, ...rest] = slotsByHost;
  if (!first) return [];

  return first.filter((slot) => {
    const startMs = slot.start.getTime();
    return rest.every((hostSlots) => hostSlots.some((s) => s.start.getTime() === startMs));
  });
}
