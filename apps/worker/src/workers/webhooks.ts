import { decrypt, hmacSha256hex, logger } from "@calsync/core";
import { eq, getDb, schema, sql } from "@calsync/db";
import { QUEUE_NAMES, type WebhookJob, connection } from "@calsync/jobs";
import { Worker } from "bullmq";

const TIMEOUT_MS = 10_000;

/**
 * Delivers a persisted webhook to its consumer endpoint with an HMAC-SHA-256
 * signature over the raw body. Updates the delivery row with the outcome. A
 * non-2xx response (or timeout) throws so BullMQ retries with backoff; the row
 * flips to `failed` only once retries are exhausted.
 */
export function startWebhooksWorker(): Worker<WebhookJob> {
  return new Worker<WebhookJob>(
    QUEUE_NAMES.webhooks,
    async (job) => {
      const db = getDb();
      const delivery = await db.query.webhookDeliveries.findFirst({
        where: eq(schema.webhookDeliveries.id, job.data.deliveryId),
        with: { endpoint: true },
      });
      if (!delivery || delivery.status === "success") return;
      const endpoint = delivery.endpoint;
      if (!endpoint || endpoint.disabledAt) return;

      await db
        .update(schema.webhookDeliveries)
        .set({ attempts: sql`${schema.webhookDeliveries.attempts} + 1` })
        .where(eq(schema.webhookDeliveries.id, delivery.id));

      const body = JSON.stringify(delivery.payload);
      const secret = decrypt(endpoint.secretEncrypted);
      const signature = hmacSha256hex(secret, body);

      let responseStatus: number | null = null;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "user-agent": "calSync-Webhooks/1.0",
            "x-calsync-event": delivery.event,
            "x-calsync-delivery": delivery.id,
            "x-calsync-signature": `sha256=${signature}`,
          },
          body,
          signal: controller.signal,
        }).finally(() => clearTimeout(timer));
        responseStatus = res.status;
        if (!res.ok) throw new Error(`consumer responded ${res.status}`);
      } catch (err) {
        await db
          .update(schema.webhookDeliveries)
          .set({ status: "failed", responseStatus })
          .where(eq(schema.webhookDeliveries.id, delivery.id));
        throw err; // let BullMQ retry
      }

      await db
        .update(schema.webhookDeliveries)
        .set({ status: "success", responseStatus })
        .where(eq(schema.webhookDeliveries.id, delivery.id));

      logger.info("webhook delivered", {
        event: "webhook_delivered",
        deliveryId: delivery.id,
        hookEvent: delivery.event,
        responseStatus,
      });
    },
    { connection, concurrency: 10 },
  );
}
