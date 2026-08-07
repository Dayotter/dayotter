import { z } from "zod";

/**
 * An ISO-8601 datetime string that MAY carry a timezone offset.
 *
 * The dashboard builds these with Luxon's `DateTime#toISO()`, which ALWAYS
 * emits a numeric offset - e.g. `2026-08-06T14:30:00.000+05:30`, or even
 * `+00:00` in UTC - and never a bare `Z`. Zod's default `.datetime()` accepts
 * only the `Z` form, so validating with it rejected every offset-bearing value
 * and surfaced to the user as "Invalid block" regardless of their timezone.
 * `{ offset: true }` accepts both `Z` and numeric offsets, which is what we want.
 */
export const isoDateTimeWithOffset = z.string().datetime({ offset: true });

/** Body schema for POST /api/time-blocks (manual personal / focus blocks). */
export const timeBlockInput = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["focus", "personal", "travel", "other"]).default("focus"),
  startsAt: isoDateTimeWithOffset,
  endsAt: isoDateTimeWithOffset,
  /** Repeat weekly for this many additional weeks (0 = one-off, max 25). */
  repeatWeeks: z.number().int().min(0).max(25).default(0),
  /** Booker/creator timezone so weekly occurrences keep the same local time (DST-safe). */
  timezone: z.string().min(1).default("UTC"),
});
export type TimeBlockInput = z.infer<typeof timeBlockInput>;

/** Body schema for POST /api/focus/block (protect a suggested focus block). */
export const focusBlockInput = z.object({
  startISO: isoDateTimeWithOffset,
  durationMinutes: z.number().int().min(15).max(480),
  title: z.string().min(1).max(120).default("Deep work"),
});
export type FocusBlockInput = z.infer<typeof focusBlockInput>;
