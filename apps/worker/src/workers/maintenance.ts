import { logger } from "@calsync/core";
import { and, eq, getDb, lt, schema } from "@calsync/db";
import { connection, enqueueSync, QUEUE_NAMES } from "@calsync/jobs";
import { Worker } from "bullmq";
import { materializeWeeklyBlocks } from "./automation-weekly";

/**
 * Meeting Lifecycle: a booking that's still `confirmed` after it has ended is
 * treated as having happened — mark it `completed`. This makes the `completed`
 * state (and analytics) meaningful without a human clicking. A host can still
 * override to `no_show` afterwards. Idempotent.
 */
export async function markPastBookingsCompleted(): Promise<void> {
  const updated = await getDb()
    .update(schema.bookings)
    .set({ status: "completed" })
    .where(and(eq(schema.bookings.status, "confirmed"), lt(schema.bookings.endsAt, new Date())))
    .returning({ id: schema.bookings.id });
  if (updated.length > 0) {
    logger.info("bookings auto-completed", {
      event: "bookings_auto_completed",
      count: updated.length,
    });
  }
}

/**
 * Periodic reconciliation: enqueue a sync for every active connection. This
 * polls webhook-less providers (Apple/CalDAV), renews expiring push
 * subscriptions (via the sync worker's ensureSubscription), and is a safety net
 * for any change a webhook might have missed. Also materializes recurring
 * (weekly) automation blocks for the horizon — idempotent, so the tick cadence
 * doesn't matter.
 */
export function startMaintenanceWorker(): Worker {
  return new Worker(
    QUEUE_NAMES.maintenance,
    async () => {
      const db = getDb();
      const conns = await db.query.calendarConnections.findMany({
        where: eq(schema.calendarConnections.status, "active"),
        columns: { id: true },
      });
      for (const c of conns) {
        await enqueueSync({ connectionId: c.id, reason: "poll" });
      }

      await materializeWeeklyBlocks();
      await markPastBookingsCompleted();
    },
    { connection, concurrency: 1 },
  );
}
