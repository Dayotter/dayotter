import { and, eq, type getDb, gte, inArray, lt, schema, sql } from "@dayotter/db";
import { DateTime } from "luxon";

/** The booking caps an event type can set, in order of increasing window size. */
export interface BookingCaps {
  id: string;
  dailyBookingLimit: number | null;
  weeklyBookingLimit: number | null;
  monthlyBookingLimit: number | null;
  yearlyBookingLimit: number | null;
}

type CapWindow = "day" | "week" | "month" | "year";

/**
 * The host-local [start, end) window a cap counts over, as absolute instants.
 * Pure + DST-correct: we do the calendar math in the host's zone (Luxon) and
 * only then convert to UTC, so e.g. "this week" is the real local week even
 * across a DST change. Mirrors the window math in create-booking's cap guard.
 */
export function capWindow(kind: CapWindow, at: Date, timezone: string): { start: Date; end: Date } {
  const local = DateTime.fromJSDate(at).setZone(timezone || "UTC");
  const unit = kind === "day" ? "day" : kind; // Luxon uses the same names for week/month/year
  const start = local.startOf(unit);
  return { start: start.toJSDate(), end: start.plus({ [`${unit}s`]: 1 }).toJSDate() };
}

/**
 * Whether placing a booking for this event type at `slotStart` would exceed one
 * of its daily/weekly/monthly/yearly caps, returning the matching user-facing
 * message (finest window first) or null if within every cap. Counts confirmed +
 * pending bookings, exactly like the create path (a pending opt-in tentatively
 * holds a cap slot).
 *
 * Read-only and best-effort: pass the plain `db`. This is the recurring-series /
 * off-request check (#64). The authoritative, race-safe guard for a live booking
 * stays in create-booking.ts, inside its locked transaction - keep the two in
 * sync if the cap semantics change.
 */
export async function bookingCapExceeded(
  db: ReturnType<typeof getDb>,
  input: { eventType: BookingCaps; slotStart: Date; timezone: string },
): Promise<string | null> {
  const { eventType, slotStart, timezone } = input;

  const checks: { limit: number | null; kind: CapWindow; message: string }[] = [
    {
      limit: eventType.dailyBookingLimit,
      kind: "day",
      message: "This day is fully booked. Please pick another day.",
    },
    {
      limit: eventType.weeklyBookingLimit,
      kind: "week",
      message: "This week is fully booked. Please pick another week.",
    },
    {
      limit: eventType.monthlyBookingLimit,
      kind: "month",
      message: "This month is fully booked. Please pick another month.",
    },
    {
      limit: eventType.yearlyBookingLimit,
      kind: "year",
      message: "This year is fully booked. Please pick another time.",
    },
  ];

  for (const { limit, kind, message } of checks) {
    if (limit == null) continue;
    const { start, end } = capWindow(kind, slotStart, timezone);
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .where(
        and(
          eq(schema.bookings.eventTypeId, eventType.id),
          inArray(schema.bookings.status, ["confirmed", "pending"]),
          gte(schema.bookings.startsAt, start),
          lt(schema.bookings.startsAt, end),
        ),
      );
    if (count >= limit) return message;
  }
  return null;
}
