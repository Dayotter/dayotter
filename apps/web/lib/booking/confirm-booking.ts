import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { bookingDeclined, sendEmail } from "@dayotter/emails";
import { finalizeConfirmedBooking } from "./finalize-booking";

/** Outcome of a host review action, mapped to HTTP status by the route. */
export type ReviewResult = "ok" | "not_found" | "forbidden" | "not_pending";

/**
 * Reconstruct the primary attendee + guest emails from the persisted attendee
 * rows. `createBooking` inserts the primary first (with a name + timezone);
 * guests carry only an email - so the primary is the row that has them.
 */
function splitAttendees(
  attendees: (typeof schema.bookingAttendees.$inferSelect)[],
  fallbackTz: string,
): { attendee: { name: string; email: string; timezone: string }; guests: string[] } {
  const primary = attendees.find((a) => a.timezone || a.name) ?? attendees[0];
  const guests = attendees.filter((a) => a !== primary).map((a) => a.email);
  return {
    attendee: {
      name: primary?.name ?? primary?.email ?? "Guest",
      email: primary?.email ?? "",
      timezone: primary?.timezone ?? fallbackTz,
    },
    guests,
  };
}

/**
 * Host approves a pending (opt-in) booking: flip `pending` → `confirmed`
 * atomically, then run the full confirmed-booking side-effect suite (meeting
 * link, host calendar, reminders, confirmation emails, recurring series) - the
 * work that was deliberately deferred when the request came in.
 */
export async function approveBooking(uid: string, hostUserId: string): Promise<ReviewResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true, eventType: true },
  });
  if (!booking) return "not_found";
  if (booking.hostId !== hostUserId) return "forbidden";
  if (booking.status !== "pending") return "not_pending";
  if (!booking.host || !booking.eventType) return "not_found";

  // Atomically claim the approval so two concurrent approvals can't both
  // finalize (double calendar write / confirmation emails).
  const claimed = await db
    .update(schema.bookings)
    .set({ status: "confirmed" })
    .where(and(eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "pending")))
    .returning({ id: schema.bookings.id });
  if (claimed.length === 0) return "not_pending";

  const { attendee, guests } = splitAttendees(booking.attendees, booking.timezone);
  await finalizeConfirmedBooking({
    booking,
    eventType: booking.eventType,
    host: booking.host,
    attendee,
    guests,
    notes: booking.description,
    appUrl: process.env.APP_URL ?? "http://localhost:3000",
  });

  logger.info("booking approved", { event: "booking_approved", bookingId: booking.id, uid });
  return "ok";
}

/**
 * Host declines a pending (opt-in) booking: mark it `rejected` and let the
 * attendee know. Nothing was ever placed on a calendar, so there's nothing to
 * unwind.
 */
export async function declineBooking(
  uid: string,
  hostUserId: string,
  reason?: string,
): Promise<ReviewResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking) return "not_found";
  if (booking.hostId !== hostUserId) return "forbidden";
  if (booking.status !== "pending") return "not_pending";

  const claimed = await db
    .update(schema.bookings)
    .set({ status: "rejected", cancelReason: reason ?? null })
    .where(and(eq(schema.bookings.id, booking.id), eq(schema.bookings.status, "pending")))
    .returning({ id: schema.bookings.id });
  if (claimed.length === 0) return "not_pending";

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await Promise.all(
      booking.attendees.map((a) =>
        sendEmail({
          ...bookingDeclined({
            eventTitle: booking.title,
            start: booking.startsAt,
            end: booking.endsAt,
            timezone: a.timezone ?? booking.timezone,
            hostName: booking.host?.name ?? "your host",
            attendeeName: a.name ?? a.email,
            manageUrl: `${appUrl}/booking/${uid}`,
            reason: reason ?? null,
          }),
          to: a.email,
        }),
      ),
    );
  } catch (err) {
    logger.error("decline email failed", {
      event: "decline_email_failed",
      bookingId: booking.id,
      err,
    });
  }

  logger.info("booking declined", { event: "booking_declined", bookingId: booking.id, uid });
  return "ok";
}
