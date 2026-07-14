import { logger } from "@dayotter/core";
import { syncBookingToCrm } from "@dayotter/integrations";
import { type CrmSyncJob, QUEUE_NAMES, connection } from "@dayotter/jobs";
import { Worker } from "bullmq";

/**
 * Pushes booking lifecycle changes to the host's connected CRMs (Salesforce /
 * HubSpot). Idempotent: contacts are found-or-created, and the meeting activity
 * is tracked per (booking, connection) so a reschedule updates and a cancel
 * closes the same record. A failure throws so BullMQ retries with backoff.
 */
export function startCrmSyncWorker(): Worker<CrmSyncJob> {
  return new Worker<CrmSyncJob>(
    QUEUE_NAMES.crmSync,
    async (job) => {
      await syncBookingToCrm(job.data.bookingId, job.data.action);
      logger.info("crm sync done", {
        event: "crm_sync_done",
        bookingId: job.data.bookingId,
        action: job.data.action,
      });
    },
    { connection, concurrency: 5 },
  );
}
