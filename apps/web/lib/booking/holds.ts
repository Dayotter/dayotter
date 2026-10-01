import { env } from "@/lib/server/env";
import { logger } from "@dayotter/core";
import { and, eq, getDb, isNotNull, schema, sql } from "@dayotter/db";
import { splitAttendees } from "./confirm-booking";
import { finalizeConfirmedBooking } from "./finalize-booking";

/**
 * Temporary booking holds (#293).
 *
 * A hold is a `pending` booking carrying a `hold_expires_at`. Because `pending`
 * rows count in the slot guards and caps (see `create-booking.ts`), a hold
 * genuinely reserves the slot the moment it's created - no one else can book it -
 * while the integrator finishes something out-of-band (typically taking payment
 * in their own app). The integrator then confirms the hold (which runs the full
 * confirmed-booking side-effect suite, exactly as a host approval would) or lets
 * it lapse, at which point a worker releases the slot.
 *
 * Confirm and release are both idempotent so an at-least-once caller (a retried
 * webhook, a double-clicked "pay") can't corrupt state or double-finalize.
 */

export type ConfirmHoldResult =
  | { status: "confirmed"; alreadyConfirmed: boolean }
  // The hold lapsed (or was released) before it could be confirmed.
  | { status: "expired" }
  // No such hold for this account - unknown uid, or a row that isn't a hold.
  | { status: "not_found" };

/**
 * Confirm a hold: atomically flip `pending` -> `confirmed` (clearing the expiry),
 * then finalize. Scoped to the owning host so one account's key can't confirm
 * another's hold. Idempotent: a second confirm of an already-confirmed hold
 * returns `alreadyConfirmed` without re-running the side-effects.
 */
export async function confirmHold(uid: string, hostUserId: string): Promise<ConfirmHoldResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true, eventType: true },
  });

  // Hide another account's bookings behind the same answer as a missing one.
  if (!booking || booking.hostId !== hostUserId) return { status: "not_found" };
  // A confirmed hold is terminal and safe to report as success on retry. We only
  // treat it as "already confirmed" when it genuinely was a hold (expiry set, now
  // cleared on confirm) - a plain booking reaching here would still read as such,
  // which is the right answer for an idempotent confirm by uid.
  if (booking.status === "confirmed") return { status: "confirmed", alreadyConfirmed: true };
  // Not a live hold: an ordinary host-review `pending` (no expiry), or a
  // cancelled/rejected row. Don't touch it through the holds API.
  if (booking.status !== "pending" || !booking.holdExpiresAt) return { status: "not_found" };
  if (!booking.host || !booking.eventType) return { status: "not_found" };
  if (booking.holdExpiresAt.getTime() <= Date.now()) return { status: "expired" };

  // Atomically claim the confirmation: only one caller can flip a still-live hold,
  // so concurrent/retried confirms can't both finalize. The `hold_expires_at`
  // predicate also rejects a hold that lapsed between the read and here.
  const claimed = await db
    .update(schema.bookings)
    .set({ status: "confirmed", holdExpiresAt: null })
    .where(
      and(
        eq(schema.bookings.id, booking.id),
        eq(schema.bookings.status, "pending"),
        isNotNull(schema.bookings.holdExpiresAt),
        sql`${schema.bookings.holdExpiresAt} > now()`,
      ),
    )
    .returning({ id: schema.bookings.id });
  if (claimed.length === 0) {
    // Lost the race: either someone else just confirmed it, or it lapsed. Re-read
    // to give the caller the true terminal answer.
    const now = await db.query.bookings.findFirst({
      where: eq(schema.bookings.id, booking.id),
      columns: { status: true },
    });
    return now?.status === "confirmed"
      ? { status: "confirmed", alreadyConfirmed: true }
      : { status: "expired" };
  }

  const { attendee, guests } = splitAttendees(booking.attendees, booking.timezone);
  await finalizeConfirmedBooking({
    booking: { ...booking, status: "confirmed", holdExpiresAt: null },
    eventType: booking.eventType,
    host: booking.host,
    attendee,
    guests,
    notes: booking.description,
    appUrl: env.APP_URL,
  });

  logger.info("hold confirmed", { event: "hold_confirmed", bookingId: booking.id, uid });
  return { status: "confirmed", alreadyConfirmed: false };
}

export type ReleaseHoldResult =
  // Deleted a live hold, or it was already gone (expired/released) - both are the
  // caller's desired end state, so both report success idempotently.
  | { status: "released" }
  // The hold was already confirmed and is now a real booking; releasing it would
  // mean cancelling, which this endpoint deliberately won't do.
  | { status: "already_confirmed" }
  | { status: "not_found" };

/**
 * Release a hold before it lapses: delete the reserving `pending` row so the slot
 * reopens immediately. Scoped to the owning host. Idempotent - releasing a hold
 * that already expired (and was swept) still reports `released`.
 */
export async function releaseHold(uid: string, hostUserId: string): Promise<ReleaseHoldResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    columns: { id: true, hostId: true, status: true, holdExpiresAt: true },
  });

  if (!booking) return { status: "released" };
  if (booking.hostId !== hostUserId) return { status: "not_found" };
  if (booking.status === "confirmed") return { status: "already_confirmed" };
  if (booking.status !== "pending" || !booking.holdExpiresAt) return { status: "not_found" };

  // Delete only while it's still an unconfirmed hold, so a confirm that lands
  // concurrently wins (the row becomes a real booking and is left intact).
  await db
    .delete(schema.bookings)
    .where(
      and(
        eq(schema.bookings.id, booking.id),
        eq(schema.bookings.status, "pending"),
        isNotNull(schema.bookings.holdExpiresAt),
      ),
    );

  logger.info("hold released", { event: "hold_released", bookingId: booking.id, uid });
  return { status: "released" };
}
