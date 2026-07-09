import { eq, getDb, schema } from "@calsync/db";
import { connection, enqueueSync, QUEUE_NAMES } from "@calsync/jobs";
import { Worker } from "bullmq";
import { materializeWeeklyBlocks } from "./automation-weekly";

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
    },
    { connection, concurrency: 1 },
  );
}
