import { logger, safeEqual } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { enqueueSync } from "@dayotter/jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Max notifications we process per request - Graph batches are small; a huge
 * array is a job-amplification attempt. */
const MAX_NOTIFICATIONS = 100;

/**
 * Microsoft Graph change notifications. Handles the subscription-validation
 * handshake (echo the validationToken) and then per-notification sync enqueue.
 */
export async function POST(request: Request) {
  const validationToken = new URL(request.url).searchParams.get("validationToken");
  if (validationToken) {
    // Graph validates a new subscription by expecting the token echoed as text.
    // Tokens are short; cap the echo so we can't be used as a reflector.
    return new NextResponse(validationToken.slice(0, 256), {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }

  const body = (await request.json().catch(() => null)) as {
    value?: Array<{ subscriptionId?: string; clientState?: string }>;
  } | null;

  const db = getDb();
  for (const notif of (body?.value ?? []).slice(0, MAX_NOTIFICATIONS)) {
    if (!notif.subscriptionId) continue;
    const sub = await db.query.webhookSubscriptions.findFirst({
      where: eq(schema.webhookSubscriptions.externalId, notif.subscriptionId),
    });
    if (!sub) {
      logger.warn("ms webhook: unknown subscription", {
        event: "webhook_rejected",
        reason: "unknown_sub",
        subscriptionId: notif.subscriptionId,
      });
      continue;
    }
    const meta = sub.metadata as { clientState?: string } | null;
    // spoof guard (constant-time)
    if (meta?.clientState && !safeEqual(notif.clientState ?? "", meta.clientState)) {
      logger.warn("ms webhook: clientState mismatch", {
        event: "webhook_rejected",
        reason: "clientState_mismatch",
        subscriptionId: notif.subscriptionId,
      });
      continue;
    }

    const cal = await db.query.calendars.findFirst({
      where: eq(schema.calendars.id, sub.calendarId),
    });
    if (cal) {
      await enqueueSync({ connectionId: cal.connectionId, calendarId: cal.id, reason: "webhook" });
    }
  }
  return new NextResponse(null, { status: 202 });
}
