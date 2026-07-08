import { decryptJson, logger } from "@calsync/core";
import { and, eq, getDb, schema } from "@calsync/db";
import { sendPush } from "./providers/push";
import { sendSlack } from "./providers/slack";
import { sendSms, sendWhatsApp, twilioConfigured } from "./providers/twilio";
import type {
  ChannelConfig,
  DeliverableChannel,
  DispatchResult,
  NotificationMessage,
} from "./types";

export type {
  ChannelConfig,
  DeliverableChannel,
  DispatchResult,
  NotificationMessage,
} from "./types";
export { twilioConfigured } from "./providers/twilio";

/** Which channel kinds this server can actually deliver to right now. */
export function availableChannels(): DeliverableChannel[] {
  const channels: DeliverableChannel[] = ["slack", "push"]; // self-contained
  if (twilioConfigured()) channels.push("whatsapp", "sms");
  return channels;
}

/** Dispatch a single message to one channel using its decrypted config. */
export async function dispatchToChannel(
  type: DeliverableChannel,
  config: ChannelConfig,
  message: NotificationMessage,
): Promise<DispatchResult> {
  switch (type) {
    case "slack":
      return "webhookUrl" in config
        ? sendSlack(config.webhookUrl, message)
        : { ok: false, reason: "bad_config" };
    case "push":
      return "pushToken" in config
        ? sendPush(config.pushToken, message)
        : { ok: false, reason: "bad_config" };
    case "whatsapp":
      return "phone" in config
        ? sendWhatsApp(config.phone, message)
        : { ok: false, reason: "bad_config" };
    case "sms":
      return "phone" in config
        ? sendSms(config.phone, message)
        : { ok: false, reason: "bad_config" };
    default:
      return { ok: false, reason: "unsupported" };
  }
}

/**
 * Deliver a notification to every one of a user's reminder-enabled, verified
 * channels. Best-effort: a failing channel never blocks the others. Returns how
 * many channels accepted the message. Email is handled separately (@calsync/emails).
 */
export async function deliverUserReminder(
  userId: string,
  message: NotificationMessage,
): Promise<number> {
  const db = getDb();
  const channels = await db.query.notificationChannels.findMany({
    where: and(
      eq(schema.notificationChannels.userId, userId),
      eq(schema.notificationChannels.remindersEnabled, true),
      eq(schema.notificationChannels.isVerified, true),
    ),
  });

  let delivered = 0;
  await Promise.all(
    channels.map(async (ch) => {
      if (ch.type === "email") return; // email reminders go through @calsync/emails
      let config: ChannelConfig;
      try {
        config = decryptJson<ChannelConfig>(ch.encryptedConfig);
      } catch (err) {
        logger.error("channel config decrypt failed", {
          event: "channel_config_decrypt_failed",
          channelId: ch.id,
          err,
        });
        return;
      }
      const result = await dispatchToChannel(ch.type as DeliverableChannel, config, message);
      if (result.ok) delivered++;
    }),
  );

  if (delivered > 0) {
    logger.info("user reminder delivered to channels", {
      event: "user_reminder_channels_delivered",
      userId,
      delivered,
    });
  }
  return delivered;
}
