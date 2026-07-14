import { logger } from "@dayotter/core";
import { and, eq, getDb, isNull, schema } from "@dayotter/db";
import { enqueueWebhook } from "@dayotter/jobs";

/** Events the platform emits. Consumers subscribe to `["*"]` or a subset. */
export type WebhookEvent = "booking.created" | "booking.cancelled" | "booking.rescheduled";

/**
 * Fan out an event to a user's enabled webhook endpoints: persist a delivery
 * row per endpoint and enqueue it for signed delivery. Best-effort - a webhook
 * problem must never break the booking flow, so all errors are swallowed.
 */
export async function emitWebhook(
  userId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const db = getDb();
    const endpoints = await db.query.webhookEndpoints.findMany({
      where: and(
        eq(schema.webhookEndpoints.userId, userId),
        isNull(schema.webhookEndpoints.disabledAt),
      ),
    });
    const targets = endpoints.filter((e) => e.events.includes("*") || e.events.includes(event));
    if (targets.length === 0) return;

    const payload = { event, createdAt: new Date().toISOString(), data };

    for (const endpoint of targets) {
      const [delivery] = await db
        .insert(schema.webhookDeliveries)
        .values({ endpointId: endpoint.id, event, payload })
        .returning({ id: schema.webhookDeliveries.id });
      if (delivery) await enqueueWebhook(delivery.id);
    }

    logger.info("webhook emitted", {
      event: "webhook_emitted",
      hookEvent: event,
      userId,
      endpoints: targets.length,
    });
  } catch (err) {
    logger.error("webhook emit failed", { event: "webhook_emit_failed", userId, err });
  }
}
