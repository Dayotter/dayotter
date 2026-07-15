import { DateTime } from "luxon";

/**
 * Shared building blocks for the daily briefings (personal + team). Both workers
 * use the same send-window guard, once-per-day check, and focus-time formatting -
 * this keeps them from drifting apart.
 */

/** How many hours after the configured hour we'll still send (else wait for tomorrow). */
export const SEND_WINDOW_HOURS = 3;

/** "2 hours of focus held" / "45 minutes of focus held" (+ optional suffix). */
export function focusLabel(totalMinutes: number, suffix = ""): string | undefined {
  if (totalMinutes <= 0) return undefined;
  if (totalMinutes >= 90) {
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours} hours of focus held${suffix}`;
  }
  return `${totalMinutes} minutes of focus held${suffix}`;
}

/** Total minutes across a set of blocks (non-negative, rounded). */
export function focusMinutes(blocks: { startsAt: Date; endsAt: Date }[]): number {
  return blocks.reduce(
    (sum, b) => sum + Math.max(0, Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000)),
    0,
  );
}

/**
 * Whether a briefing is due right now: inside the morning send window for `hour`
 * (in `tz`) and not already sent today. Returns the local time + today's date
 * (for the once-per-day marker) when due, else null.
 */
export function briefingDue(
  now: Date,
  tz: string,
  hour: number,
  lastSent: string | null,
): { local: DateTime; today: string } | null {
  const local = DateTime.fromJSDate(now).setZone(tz || "UTC");
  const today = local.toFormat("yyyy-LL-dd");
  if (lastSent === today) return null;
  if (local.hour < hour || local.hour >= hour + SEND_WINDOW_HOURS) return null;
  return { local, today };
}
