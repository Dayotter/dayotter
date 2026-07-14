import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { BookingError, createBooking } from "../booking/create-booking";
import { claimPendingBooking } from "./pending";
import { refundPayment, retrieveSession } from "./stripe";

/**
 * Turn a paid Checkout Session into a confirmed booking. Idempotent + safe to
 * call from BOTH the success redirect and the webhook - the pending payload is
 * claimed atomically (GETDEL) and the paymentIntent id is the dedup key.
 *
 * Returns the booking uid, or `pending: true` when the other handler is mid-flight.
 */
export async function fulfillCheckout(
  sessionId: string,
): Promise<{ uid: string | null; pending: boolean }> {
  const session = await retrieveSession(sessionId);
  if (session.payment_status !== "paid") return { uid: null, pending: true };

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);
  if (!pi) return { uid: null, pending: false };

  const db = getDb();
  const existing = await db.query.bookings.findFirst({
    where: eq(schema.bookings.paymentIntentId, pi),
  });
  if (existing) return { uid: existing.uid, pending: false };

  const token = session.metadata?.token;
  if (!token) return { uid: null, pending: false };

  const input = await claimPendingBooking(token);
  if (!input) {
    // The other handler claimed the payload; it may still be creating the row.
    const again = await db.query.bookings.findFirst({
      where: eq(schema.bookings.paymentIntentId, pi),
    });
    return { uid: again?.uid ?? null, pending: !again };
  }

  try {
    const { uid } = await createBooking({
      ...input,
      payment: {
        paymentIntentId: pi,
        amountPaid: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
      },
    });
    return { uid, pending: false };
  } catch (err) {
    // Slot was taken between checkout and fulfillment. If the other handler won
    // the race, use its booking; otherwise the payment can't be honoured → refund.
    if (err instanceof BookingError) {
      const raced = await db.query.bookings.findFirst({
        where: eq(schema.bookings.paymentIntentId, pi),
      });
      if (raced) return { uid: raced.uid, pending: false };
      logger.error("paid booking failed after payment - refunding", {
        event: "paid_booking_refunded",
        paymentIntentId: pi,
        err,
      });
      await refundPayment(pi);
      throw err;
    }
    throw err;
  }
}
