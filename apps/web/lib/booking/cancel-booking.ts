import { logger } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { bookingCancellation, sendEmail } from "@calsync/emails";
import { deleteBookingFromCalendar } from "../calendar/host-calendar";
import { paymentsEnabled, refundPayment } from "../payments/stripe";
import { emitWebhook } from "../webhooks/emit";
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

  // Refund a paid booking on cancellation (best-effort, before marking cancelled).
  let refunded = false;
  if (paymentsEnabled && booking.paymentStatus === "paid" && booking.paymentIntentId) {
    refunded = await refundPayment(booking.paymentIntentId);
    if (refunded) {
      logger.info("booking payment refunded on cancel", {
        event: "booking_refunded",
        bookingId: booking.id,
      });
    }
  }

  await db
    .update(schema.bookings)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason,
      ...(refunded ? { paymentStatus: "refunded" as const } : {}),
    })
    .where(eq(schema.bookings.id, booking.id));

  // Remove from the host's calendar (best-effort).
  await deleteBookingFromCalendar(booking.id);

  // Cancel any pending reminder jobs.
  await clearBookingReminders(booking.id);

  // Release travel / prep / buffer blocks this booking reserved (else the time
  // stays blocked forever).
  await db
    .delete(schema.timeBlocks)
    .where(eq(schema.timeBlocks.bookingId, booking.id))
    .catch(() => {});

  if (booking.hostId) {
    await emitWebhook(booking.hostId, "booking.cancelled", {
      uid,
      eventTypeId: booking.eventTypeId,
      title: booking.title,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      reason: reason ?? null,
    });
  }

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
    logger.error("cancellation email failed", {
      event: "cancel_email_failed",
      bookingId: booking.id,
      err,
    });
  }

  return true;
}
