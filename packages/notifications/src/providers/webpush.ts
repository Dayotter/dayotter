import { logger } from "@dayotter/core";
import webpush from "web-push";
import type { DispatchResult, NotificationMessage, WebPushSubscription } from "../types";

/**
 * Desktop/browser notifications via the Web Push protocol (RFC 8291) with VAPID.
 * Requires a VAPID keypair — generate once with `npx web-push generate-vapid-keys`
 * and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY. The public key is also exposed to
 * the browser as NEXT_PUBLIC_VAPID_PUBLIC_KEY so it can subscribe.
 */
export function webPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let vapidReady = false;
function ensureVapid(): boolean {
  if (vapidReady) return true;
  if (!webPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:notifications@dayotter.com",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  vapidReady = true;
  return true;
}

export async function sendWebPush(
  subscription: WebPushSubscription,
  message: NotificationMessage,
): Promise<DispatchResult> {
  if (!ensureVapid()) return { ok: false, reason: "not_configured" };

  const payload = JSON.stringify({
    title: message.title,
    body: message.body,
    url: message.url,
  });

  try {
    await webpush.sendNotification(subscription, payload);
    return { ok: true };
  } catch (err) {
    // 404/410 mean the subscription is dead (unsubscribed / browser cleared it);
    // surface it distinctly so callers can prune the channel.
    const status = (err as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) {
      return { ok: false, reason: "expired" };
    }
    logger.warn("web push dispatch failed", { event: "webpush_dispatch_failed", status });
    return { ok: false, reason: status ? `http_${status}` : "network" };
  }
}
