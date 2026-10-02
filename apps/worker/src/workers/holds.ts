import { logger } from "@dayotter/core";
import { and, eq, getDb, isNotNull, lt, schema } from "@dayotter/db";
import { type HoldReleaseJob, QUEUE_NAMES, connection } from "@dayotter/jobs";
import { Worker } from "bullmq";

/**
 * Release lapsed temporary holds (#293). A hold is a `pending` booking with a
 * `hold_expires_at`; deleting the row reopens the slot (the partial unique /
 * no-overlap guards keep it locked until the row is gone). Two paths feed this:
 * a per-hold delayed job for prompt release at expiry, and a bulk sweep on the
 * maintenance tick as a backstop for any delayed job that was lost.
 *
 * Only ever touches rows that are STILL an unconfirmed, expired hold, so a hold
 * confirmed (and `hold_expires_at` cleared) just before the job runs is safe.
 */

/** Release one hold by id, iff it's still an expired unconfirmed hold. */
export async function releaseHoldById(bookingId: string): Promise<boolean> {
  const deleted = await getDb()
    .delete(schema.bookings)
    .where(
      and(
        eq(schema.bookings.id, bookingId),
        eq(schema.bookings.status, "pending"),
        isNotNull(schema.bookings.holdExpiresAt),
        lt(schema.bookings.holdExpiresAt, new Date()),
      ),
    )
    .returning({ id: schema.bookings.id });
  return deleted.length > 0;
}

/** Bulk-release every lapsed hold. Backstop for lost per-hold release jobs. */
export async function releaseExpiredHolds(): Promise<void> {
  const released = await getDb()
    .delete(schema.bookings)
    .where(
      and(
        eq(schema.bookings.status, "pending"),
        isNotNull(schema.bookings.holdExpiresAt),
        lt(schema.bookings.holdExpiresAt, new Date()),
      ),
    )
    .returning({ id: schema.bookings.id });
  if (released.length > 0) {
    logger.info("expired holds released", {
      event: "holds_swept",
      count: released.length,
    });
  }
}

export function startHoldsWorker(): Worker {
  return new Worker<HoldReleaseJob>(
    QUEUE_NAMES.holds,
    async (job) => {
      const released = await releaseHoldById(job.data.bookingId);
      logger.info("hold release job ran", {
        event: "hold_release_job",
        bookingId: job.data.bookingId,
        released,
      });
    },
    { connection, concurrency: 5 },
  );
}
