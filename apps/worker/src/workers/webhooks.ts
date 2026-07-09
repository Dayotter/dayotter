import https from "node:https";
import { assertPublicHttpUrl, decrypt, hmacSha256hex, logger, resolvePublicIp } from "@calsync/core";
import { eq, getDb, schema, sql } from "@calsync/db";
import { QUEUE_NAMES, type WebhookJob, connection } from "@calsync/jobs";
import { Worker } from "bullmq";

const TIMEOUT_MS = 10_000;

/**
 * POST to a consumer URL with SSRF protection: HTTPS-only, hostname + DNS both
 * validated against internal ranges, the connection PINNED to the validated
 * public IP (defeats DNS-rebinding), and NO redirect following (node:https does
 * not auto-redirect, so a 3xx is returned as-is → treated as a failure).
 * Returns the HTTP status code.
 */
async function postSigned(
  rawUrl: string,
  headers: Record<string, string>,
  body: string,
): Promise<number> {
  const url = assertPublicHttpUrl(rawUrl, { requireHttps: true });
  const pinned = await resolvePublicIp(url.hostname);
  return await new Promise<number>((resolve, reject) => {
    const req = https.request(
      {
        host: pinned.address, // connect to the validated IP, not a re-resolved host
        servername: url.hostname, // SNI + certificate hostname validation
        port: url.port ? Number(url.port) : 443,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: { ...headers, host: url.host },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        res.resume(); // drain; we don't need the body
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("timeout", () => req.destroy(new Error("webhook delivery timed out")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
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
      const signature = hmacSha256hex(secret, body);

      let responseStatus: number | null = null;
      try {
        responseStatus = await postSigned(
          endpoint.url,
          {
            "content-type": "application/json",
            "user-agent": "calSync-Webhooks/1.0",
            "x-calsync-event": delivery.event,
            "x-calsync-delivery": delivery.id,
            "x-calsync-signature": `sha256=${signature}`,
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
