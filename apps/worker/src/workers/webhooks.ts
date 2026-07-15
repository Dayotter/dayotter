import { decrypt, hmacSha256hex, logger, safeFetch } from "@dayotter/core";
import { eq, getDb, schema, sql } from "@dayotter/db";
import { QUEUE_NAMES, type WebhookJob, connection } from "@dayotter/jobs";
import { Worker } from "bullmq";

const TIMEOUT_MS = 10_000;

/**
 * POST to a consumer URL through the shared SSRF-safe fetch (HTTPS-only,
 * connection pinned to the validated public IP, no redirects followed). Returns
 * the HTTP status code.
 */
async function postSigned(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
): Promise<number> {
  const res = await safeFetch(rawUrl, {
    method: "POST",
    headers,
    body,
    timeoutMs: TIMEOUT_MS,
  });
  return res.status;
}

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
      // Sign `timestamp.body` (Stripe-style) so a consumer can reject replays by
      // checking the timestamp is recent before trusting the signature.
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = hmacSha256hex(secret, `${timestamp}.${body}`);

      let responseStatus: number | null = null;
      try {
        responseStatus = await postSigned(
          endpoint.url,
          {
            "content-type": "application/json",
            "user-agent": "dayotter-Webhooks/1.0",
            "x-dayotter-event": delivery.event,
            "x-dayotter-delivery": delivery.id,
            "x-dayotter-timestamp": String(timestamp),
            "x-dayotter-signature": `t=${timestamp},v1=${signature}`,
          },
          body,
        );
        if (responseStatus < 200 || responseStatus >= 300) {
          throw new Error(`consumer responded ${responseStatus}`);
        }
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
