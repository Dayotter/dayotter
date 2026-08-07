import { primaryOrg } from "@/lib/billing/entitlements";
import { logger } from "@dayotter/core";
import { getDb, schema } from "@dayotter/db";
import { enqueueGuardrailAlert } from "@dayotter/jobs";

/** Where the assistant hit the guardrail. */
export type GuardrailSource = "chat" | "booking-assistant" | "voice";

/**
 * Persist a guardrail hit and enqueue a throttled owner alert. Best-effort:
 * this must never throw into the request path - the user still gets the refusal
 * whether or not we manage to record/notify. A missing Redis (enqueue) or DB
 * just means no alert; it never breaks the assistant response.
 */
export async function recordGuardrailHit(input: {
  userId?: string;
  source: GuardrailSource;
  reason: string;
  sample: string;
}): Promise<void> {
  try {
    const org = input.userId ? await primaryOrg(input.userId) : null;
    const [row] = await getDb()
      .insert(schema.guardrailEvents)
      .values({
        organizationId: org?.id ?? null,
        userId: input.userId ?? null,
        source: input.source,
        reason: input.reason,
        sample: input.sample.slice(0, 200),
      })
      .returning({ id: schema.guardrailEvents.id });
    // Only worth alerting when we know which org's owner to notify.
    if (row && org?.id) await enqueueGuardrailAlert(row.id);
  } catch (err) {
    logger.warn("failed to record guardrail hit", {
      event: "guardrail_record_failed",
      source: input.source,
      err,
    });
  }
}
