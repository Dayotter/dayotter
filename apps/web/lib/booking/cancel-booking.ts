import { logger } from "@dayotter/core";
import { and, eq, getDb, ne, schema } from "@dayotter/db";
import { bookingCancellation, sendEmail } from "@dayotter/emails";
import { deleteBookingFromCalendar } from "../calendar/host-calendar";
import { restoreCredit } from "../packages/credits";
import { paymentsEnabled, refundPayment } from "../payments/stripe";
import { fanOutBookingLifecycle } from "./lifecycle";
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

  // Atomically claim the cancellation: flip status only if it isn't already
  // cancelled. Two concurrent cancels race here and exactly one wins - the loser
  // stops, so we never refund twice or reclaim the freed time twice.
  const claimed = await db
    .update(schema.bookings)
    .set({ status: "cancelled", cancelledAt: new Date(), cancelReason: reason })
    .where(and(eq(schema.bookings.id, booking.id), ne(schema.bookings.status, "cancelled")))
    .returning({ id: schema.bookings.id });
  if (claimed.length === 0) return false;

  // Refund a paid booking (best-effort, after the claim so only the winner pays).
  let refunded = false;
  if (paymentsEnabled && booking.paymentStatus === "paid" && booking.paymentIntentId) {
    // Destination charge: reverse the transfer so the host's balance is debited
    // too, otherwise the platform eats the refund while the host keeps the funds.
    refunded = await refundPayment(booking.paymentIntentId, Boolean(booking.destinationAccountId));
    if (refunded) {
      logger.info("booking payment refunded on cancel", {
        event: "booking_refunded",
        bookingId: booking.id,
      });
    }
  } else if (booking.paymentStatus === "paid" && !booking.paymentIntentId) {
    // Paid with a prepaid package credit (no Stripe charge) - give the credit back.
    const attendee = booking.attendees[0];
    if (attendee?.email) {
      refunded = await restoreCredit(booking.eventTypeId, attendee.email).catch(() => false);
    }
  }

  if (refunded) {
    await db
      .update(schema.bookings)
      .set({ paymentStatus: "refunded" })
      .where(eq(schema.bookings.id, booking.id));
  }

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
    const startsAt = booking.startsAt.toISOString();
    const endsAt = booking.endsAt.toISOString();
    await fanOutBookingLifecycle(
      "cancelled",
      {
        bookingId: booking.id,
        uid,
        hostId: booking.hostId,
        eventTypeId: booking.eventTypeId,
        title: booking.title,
        startsAt,
        endsAt,
        attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
        reason: reason ?? null,
      },
      {
        uid,
        eventTypeId: booking.eventTypeId,
        title: booking.title,
        startsAt,
        endsAt,
        reason: reason ?? null,
      },
    );
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
            reason: reason ?? null,
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
