import { logger } from "@dayotter/core";
import { type SyncJob, connection, scheduleMaintenance, writeHeartbeat } from "@dayotter/jobs";
import { startMaintenanceWorker } from "./workers/maintenance";
import { startRemindersWorker } from "./workers/reminders";
import { startSyncWorker } from "./workers/sync";
import { startWebhooksWorker } from "./workers/webhooks";

const HEARTBEAT_INTERVAL_MS = 30_000;

/** Boots all background workers for dayotter. */
async function main(): Promise<void> {
  logger.info("worker starting", { event: "worker_starting" });

  const reminders = startRemindersWorker();
  const sync = startSyncWorker();
  const maintenance = startMaintenanceWorker();
  const webhooks = startWebhooksWorker();

  const workers = [
    ["reminders", reminders],
    ["sync", sync],
    ["maintenance", maintenance],
    ["webhooks", webhooks],
  ] as const;

  for (const [name, worker] of workers) {
    worker.on("ready", () =>
      logger.info(`${name} worker ready`, { event: "worker_ready", worker: name }),
    );
    worker.on("failed", (job, err) => {
      // Sync jobs carry rich context — surface it so an operator can see which
      // connection/provider/reason failed without cross-referencing job ids.
      const data = (job?.data ?? {}) as Partial<SyncJob>;
      logger.error(`${name} job failed`, {
        event: "job_failed",
        worker: name,
        jobId: job?.id,
        attemptsMade: job?.attemptsMade,
        connectionId: data.connectionId,
        calendarId: data.calendarId,
        reason: data.reason,
        err,
      });
    });
    worker.on("stalled", (jobId) => {
      logger.warn(`${name} job stalled`, { event: "job_stalled", worker: name, jobId });
    });
    worker.on("error", (err) => {
      logger.error(`${name} worker error`, { event: "worker_error", worker: name, err });
    });
  }

  // Register the repeatable calendar-maintenance tick (poll + subscription renewal).
  await scheduleMaintenance();

  // Liveness heartbeat for the web /health probe.
  await writeHeartbeat();
  const heartbeat = setInterval(() => {
    writeHeartbeat().catch((err) =>
      logger.warn("heartbeat write failed", { event: "heartbeat_failed", err }),
    );
  }, HEARTBEAT_INTERVAL_MS);

  const shutdown = async () => {
    logger.info("worker shutting down", { event: "worker_shutdown" });
    clearInterval(heartbeat);
    await Promise.all(workers.map(([, w]) => w.close()));
    await connection.quit();
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

void main();
