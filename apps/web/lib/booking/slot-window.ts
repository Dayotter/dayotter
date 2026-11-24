/** Days of slots the booking page fetches and shows at a time. */
export const WINDOW_DAYS = 14;

const DAY_MS = 86_400_000;
const WINDOW_MS = WINDOW_DAYS * DAY_MS;
/** Phone clocks drift from the server that computed `bookableUntil`. */
const CLOCK_SKEW_MS = 3_600_000;

/**
 * The slice of availability the booking page shows. `start` is where the
 * booker navigated to (null = today); `bookableUntil` is the event type's
 * booking-window limit in epoch ms (null = unlimited). Pure - unit-tested.
 */
export function slotWindow(start: number | null, now: number, bookableUntil: number | null) {
  const from = Math.max(start ?? now, now);
  const to = from + WINDOW_MS;
  return {
    from,
    to,
    hasPrev: from > now,
    hasNext: bookableUntil == null || to + CLOCK_SKEW_MS < bookableUntil,
  };
}

/**
 * Where a day picked in the date input should page to: null for a day before
 * today (also what a year half-typed on a keyboard looks like), otherwise the
 * day, kept inside the last bookable window.
 */
export function jumpTarget(day: number, now: number, bookableUntil: number | null) {
  if (day + DAY_MS <= now) return null;
  return bookableUntil == null ? day : Math.min(day, bookableUntil - WINDOW_MS);
}
