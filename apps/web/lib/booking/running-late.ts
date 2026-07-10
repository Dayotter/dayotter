import { logger } from "@calsync/core";
import { and, asc, eq, getDb, gt, lt, schema } from "@calsync/db";
import { bookingRunningLate, sendEmail } from "@calsync/emails";

export type RunningLateResult = "ok" | "not_found" | "forbidden";
export type OverflowResult = RunningLateResult | "no_next";

/** How close the following meeting must start to count as "back-to-back". */
const OVERFLOW_WINDOW_MS = 90 * 60_000;

/**
 * The overflow "running late" nudge: notify a booking's attendees that the host
 * is running late. Host-only. No provider calls — purely off our own bookings.
 */
export async function notifyRunningLate(
  uid: string,
  hostUserId: string,
  minutes?: number,
): Promise<RunningLateResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking || booking.status === "cancelled") return "not_found";
  if (booking.hostId !== hostUserId) return "forbidden";

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await Promise.all(
    booking.attendees.map((a) =>
      sendEmail({
        ...bookingRunningLate({
          eventTitle: booking.title,
          start: booking.startsAt,
          end: booking.endsAt,
          timezone: a.timezone ?? booking.timezone,
          hostName: booking.host?.name ?? "Your host",
          attendeeName: a.name ?? a.email,
          meetingUrl: booking.meetingUrl ?? undefined,
          manageUrl: `${appUrl}/booking/${uid}`,
          minutes,
        }),
        to: a.email,
      }),
    ),
  );

  logger.info("running-late notice sent", {
    event: "running_late_notified",
    bookingId: booking.id,
    minutes,
  });
  return "ok";
}

/**
 * Overflow nudge (#6): a meeting ran long and the host has a back-to-back one
 * right after. Notify *the next meeting's* attendees that the host may join
 * late, so they aren't left waiting. Host-only; no-ops if nothing follows soon.
 */
export async function notifyNextMeetingDelayed(
  currentUid: string,
  hostUserId: string,
  minutes?: number,
): Promise<OverflowResult> {
  const db = getDb();
  const current = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, currentUid),
    columns: { id: true, hostId: true, endsAt: true },
  });
  if (!current) return "not_found";
  if (current.hostId !== hostUserId) return "forbidden";

  // The soonest confirmed meeting starting after this one ends, within the window.
  const next = await db.query.bookings.findFirst({
    where: and(
      eq(schema.bookings.hostId, hostUserId),
      eq(schema.bookings.status, "confirmed"),
      gt(schema.bookings.startsAt, current.endsAt),
      lt(schema.bookings.startsAt, new Date(current.endsAt.getTime() + OVERFLOW_WINDOW_MS)),
    ),
    orderBy: asc(schema.bookings.startsAt),
    with: { attendees: true, host: true },
  });
  if (!next) return "no_next";

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await Promise.all(
    next.attendees.map((a) =>
      sendEmail({
        ...bookingRunningLate({
          eventTitle: next.title,
          start: next.startsAt,
          end: next.endsAt,
          timezone: a.timezone ?? next.timezone,
          hostName: next.host?.name ?? "Your host",
          attendeeName: a.name ?? a.email,
          meetingUrl: next.meetingUrl ?? undefined,
          manageUrl: `${appUrl}/booking/${next.uid}`,
          minutes,
        }),
        to: a.email,
      }),
    ),
  );

  logger.info("overflow notice sent to next meeting", {
    event: "overflow_notified",
    fromBookingId: current.id,
    nextBookingId: next.id,
    minutes,
  });
  return "ok";
}
