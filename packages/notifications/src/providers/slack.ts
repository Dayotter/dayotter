import { logger } from "@dayotter/core";
import type { DispatchResult, NotificationMessage } from "../types";

/**
 * Deliver to a Slack incoming webhook. Self-contained: the destination webhook
 * URL travels with the channel config, so no server-wide Slack app is required.
 */
export async function sendSlack(
  webhookUrl: string,
  message: NotificationMessage,
): Promise<DispatchResult> {
  if (!/^https:\/\/hooks\.slack\.com\//.test(webhookUrl)) {
    return { ok: false, reason: "invalid_webhook" };
  }

  const text = message.url
    ? `*${message.title}*\n${message.body}\n<${message.url}|View>`
    : `*${message.title}*\n${message.body}`;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      logger.warn("slack dispatch failed", { event: "slack_dispatch_failed", status: res.status });
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    logger.error("slack dispatch error", { event: "slack_dispatch_error", err });
    return { ok: false, reason: "network" };
  }
}
