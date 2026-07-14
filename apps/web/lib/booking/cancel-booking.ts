import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { bookingCancellation, sendEmail } from "@dayotter/emails";
import { enqueueCrmSync } from "@dayotter/jobs";
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

  // Smart rescheduling: if the host opted in, reclaim a cancelled FUTURE 1:1's
  // freed time as a focus block rather than re-opening it for booking. Group
  // events are skipped (other attendees may still hold the slot). Standalone
  // block (no bookingId) so the host can drop it from the block manager.
  if (booking.hostId && !booking.isGroup && booking.startsAt.getTime() > Date.now()) {
    const prefs = await db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, booking.hostId),
      columns: { reclaimCancelledTime: true },
    });
    if (prefs?.reclaimCancelledTime) {
      await db
        .insert(schema.timeBlocks)
        .values({
          userId: booking.hostId,
          title: "Focus (freed up)",
          kind: "focus",
          source: "reclaimed",
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
        })
        .catch((err) =>
          logger.warn("reclaim focus block failed", { event: "reclaim_failed", err }),
        );
    }
  }

  if (booking.hostId) {
    await emitWebhook(booking.hostId, "booking.cancelled", {
      uid,
      eventTypeId: booking.eventTypeId,
      title: booking.title,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      reason: reason ?? null,
    });
    await enqueueCrmSync({ bookingId: booking.id, action: "cancelled" }).catch(() => {});
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
