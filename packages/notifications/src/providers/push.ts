import { logger } from "@calsync/core";
import type { DispatchResult, NotificationMessage } from "../types";

/**
 * Mobile push via Expo's push service. Self-contained: Expo push tokens carry
 * their own routing, so no APNs/FCM server keys are needed for the managed flow.
 * The mobile app registers its Expo push token as a "push" channel.
 */
export async function sendPush(
  pushToken: string,
  message: NotificationMessage,
): Promise<DispatchResult> {
  if (!pushToken.startsWith("ExponentPushToken") && !pushToken.startsWith("ExpoPushToken")) {
    return { ok: false, reason: "invalid_token" };
  }

  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        to: pushToken,
        title: message.title,
        body: message.body,
        data: message.url ? { url: message.url } : undefined,
        sound: "default",
      }),
    });
    if (!res.ok) {
      logger.warn("push dispatch failed", { event: "push_dispatch_failed", status: res.status });
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    logger.error("push dispatch error", { event: "push_dispatch_error", err });
    return { ok: false, reason: "network" };
  }
}
