import { z } from "zod";
import { isoDateTimeWithOffset } from "./time-block";

/**
 * Body schema for POST /api/bookings/[uid]/reschedule.
 *
 * `start` must accept numeric offsets: the dashboard's Otter chat builds it with
 * Luxon `toISO()` (e.g. `...T13:00:00.000-04:00`) and AI drafts from voice /
 * mobile can carry one too. A `Z`-only check rejected every non-UTC user with
 * "Invalid start time". `rescheduleBooking` normalizes via `new Date()`, so the
 * stored instant is UTC either way.
 */
export const rescheduleInput = z.object({
  start: isoDateTimeWithOffset,
  reason: z.string().max(500).optional(),
});
export type RescheduleInput = z.infer<typeof rescheduleInput>;
