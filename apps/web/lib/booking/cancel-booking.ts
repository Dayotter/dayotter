import { logger } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { bookingCancellation, sendEmail } from "@calsync/emails";
import { deleteBookingFromCalendar } from "../calendar/host-calendar";
import { clearBookingReminders } from "./reminders";

/**
 * Cancel a booking by its public uid: mark cancelled, remove the calendar event,
 * cancel pending reminders, and notify attendees. Idempotent.
 */
export async function cancelBooking(uid: string, reason?: string): Promise<boolean> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking || booking.status === "cancelled") return false;

  await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
    .where(eq(schema.bookings.id, booking.id));

  // Remove from the host's calendar (best-effort).
  await deleteBookingFromCalendar(booking.id);

  // Cancel any pending reminder jobs.
  await clearBookingReminders(booking.id);

  // Notify attendees.
  try {
    await Promise.all(
      booking.attendees.map((a) =>
        sendEmail({
          ...bookingCancellation({
            eventTitle: booking.title,
            start: booking.startsAt,
            end: booking.endsAt,
            timezone: a.timezone ?? booking.timezone,
            hostName: booking.host?.name ?? "your host",
            attendeeName: a.name ?? a.email,
            manageUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/booking/${uid}`,
          }),
          to: a.email,
        }),
      ),
    );
  } catch (err) {
    logger.error("cancellation email failed", { event: "cancel_email_failed", bookingId: booking.id, err });
  }

  return true;
}
