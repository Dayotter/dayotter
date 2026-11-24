/** Days of slots the booking page fetches and shows at a time. */
export const WINDOW_DAYS = 14;

const WINDOW_MS = WINDOW_DAYS * 86_400_000;

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
    hasNext: bookableUntil == null || to < bookableUntil,
  };
}
