import { logger, safeEqual } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { enqueueSync } from "@dayotter/jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Google Calendar push notifications. Google POSTs here (no body) with headers
 * identifying the channel; we map the channel to its calendar and enqueue a
 * sync. Must return 2xx quickly. The `X-Goog-Channel-Token` we registered with
 * `events.watch` is the shared secret that proves the notification is genuinely
 * from Google — without it, anyone who guesses a channel id could force syncs.
 */
export async function POST(request: Request) {
  const state = request.headers.get("x-goog-resource-state");
  const channelId = request.headers.get("x-goog-channel-id");
  const token = request.headers.get("x-goog-channel-token") ?? "";

  // The first "sync" message just confirms the channel; nothing changed yet.
  if (state === "sync" || !channelId) return new NextResponse(null, { status: 200 });

  const db = getDb();
  const sub = await db.query.webhookSubscriptions.findFirst({
    where: eq(schema.webhookSubscriptions.externalId, channelId),
  });
  if (!sub) {
    logger.warn("google webhook: unknown channel", {
      event: "webhook_rejected",
      reason: "unknown_sub",
      channelId,
    });
    return new NextResponse(null, { status: 200 });
  }

  const meta = sub.metadata as { clientState?: string } | null;
  // Reject forged notifications: the channel token must match the secret we
  // registered. Always 200 so we don't leak which channel ids exist.
  if (!meta?.clientState || !safeEqual(token, meta.clientState)) {
    logger.warn("google webhook: token mismatch", {
      event: "webhook_rejected",
      reason: "token_mismatch",
      channelId,
    });
    return new NextResponse(null, { status: 200 });
  }

  const cal = await db.query.calendars.findFirst({
    where: eq(schema.calendars.id, sub.calendarId),
  });
  if (cal) {
    await enqueueSync({ connectionId: cal.connectionId, calendarId: cal.id, reason: "webhook" });
  }
  return new NextResponse(null, { status: 200 });
}
