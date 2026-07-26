import { DateTime } from "luxon";
import { computeAvailability } from "./engine";
import type { AvailabilityInput, DateOverride } from "./types";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface DayWindow {
  start: string;
  end: string;
}

export interface DayDiagnosis {
  /** ISO date (schedule timezone). */
  date: string;
  weekday: string;
  /** Open windows that day (wall-clock), from the override or the weekly rules. */
  scheduleWindows: DayWindow[];
  override: DateOverride | null;
  /** No working hours at all that day. */
  dayOff: boolean;
  beyondBookingWindow: boolean;
  /** Slots the grid would produce ignoring busy/notice (i.e. schedule capacity). */
  totalSlots: number;
  bookableSlots: number;
  blockedByBusy: number;
  blockedByNoticeOrRange: number;
  /** Human-readable explanation, most important first. */
  reasons: string[];
}

/**
 * Explain why a single day offers the slots it does (or none). Re-runs the real
 * availability engine three times over the day - once raw, once with busy, once
 * fully - and diffs the counts, so the attribution can never drift from what the
 * booker actually sees. `input.rangeStart` selects the day (in the schedule tz).
 */
export function explainDay(input: AvailabilityInput): DayDiagnosis {
  const zone = input.schedule.timezone;
  const day = DateTime.fromJSDate(input.rangeStart, { zone });
  const dayStart = day.startOf("day").toJSDate();
  const dayEnd = day.endOf("day").toJSDate();
  const isoDate = day.toISODate() ?? "";
  const dow = day.weekday === 7 ? 0 : day.weekday; // Luxon 1=Mon..7=Sun -> 0=Sun

  const override = input.schedule.overrides.find((o) => o.date === isoDate) ?? null;

  const scheduleWindows: DayWindow[] = override
    ? override.startTime && override.endTime
      ? [{ start: override.startTime, end: override.endTime }]
      : []
    : input.schedule.rules
        .filter((r) => r.dayOfWeek === dow)
        .map((r) => ({ start: r.startTime, end: r.endTime }));

  const dayRange = { ...input, rangeStart: dayStart, rangeEnd: dayEnd };
  // Capacity/busy passes must ignore the *time gates* (minimum notice + booking
  // window), else a distant day reads as "0 slots" purely because it's outside
  // the window - hiding the real reason. Those gates are attributed separately.
  const openEvent = { ...input.event, minimumNoticeMinutes: 0, bookingWindowDays: null };
  const totalSlots = computeAvailability({
    ...dayRange,
    busy: [],
    event: openEvent,
    now: dayStart,
  }).length;
  const afterBusy = computeAvailability({ ...dayRange, event: openEvent, now: dayStart }).length;
  const bookableSlots = computeAvailability(dayRange).length; // real notice + window + now
  const blockedByBusy = Math.max(0, totalSlots - afterBusy);
  const blockedByNoticeOrRange = Math.max(0, afterBusy - bookableSlots);

  const beyondBookingWindow =
    input.event.bookingWindowDays != null &&
    dayStart.getTime() > input.now.getTime() + input.event.bookingWindowDays * 86_400_000;

  const dayOff = totalSlots === 0;

  const reasons: string[] = [];
  if (override && (!override.startTime || !override.endTime)) {
    reasons.push(`${isoDate} is marked unavailable (a date override closes the day).`);
  } else if (dayOff) {
    reasons.push(`No working hours are set for ${WEEKDAYS[dow]}.`);
  }
  if (beyondBookingWindow) {
    reasons.push(`This day is beyond the ${input.event.bookingWindowDays}-day booking window.`);
  }
  if (!dayOff && !beyondBookingWindow && bookableSlots === 0) {
    if (blockedByBusy > 0) {
      reasons.push("Every slot is blocked by a busy event, a buffer, or an existing booking.");
    }
    if (blockedByNoticeOrRange > 0) {
      reasons.push("Remaining slots fall inside the minimum-notice window.");
    }
  }
  if (bookableSlots > 0) {
    reasons.push(`${bookableSlots} slot${bookableSlots === 1 ? "" : "s"} available.`);
  }

  return {
    date: isoDate,
    weekday: WEEKDAYS[dow] ?? "",
    scheduleWindows,
    override,
    dayOff,
    beyondBookingWindow,
    totalSlots,
    bookableSlots,
    blockedByBusy,
    blockedByNoticeOrRange,
    reasons,
  };
}
