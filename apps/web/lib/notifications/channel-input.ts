import type { ChannelConfig, DeliverableChannel } from "@calsync/notifications";
import { z } from "zod";

const E164 = /^\+[1-9]\d{6,14}$/;

/** Validated payload for adding a notification channel (one variant per type). */
export const channelInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("slack"),
    webhookUrl: z
      .string()
      .url()
      .regex(/^https:\/\/hooks\.slack\.com\//, "Must be a Slack incoming webhook URL"),
  }),
  z.object({
    type: z.literal("whatsapp"),
    phone: z.string().regex(E164, "Use an international number like +14155551234"),
  }),
  z.object({
    type: z.literal("sms"),
    phone: z.string().regex(E164, "Use an international number like +14155551234"),
  }),
  z.object({
    type: z.literal("push"),
    pushToken: z.string().min(1).max(300),
    platform: z.enum(["ios", "android"]).optional(),
  }),
]);

export type ChannelInput = z.infer<typeof channelInputSchema>;

/** Extract the storable (to-be-encrypted) config from a validated input. */
export function configFromInput(input: ChannelInput): ChannelConfig {
  switch (input.type) {
    case "slack":
      return { webhookUrl: input.webhookUrl };
    case "whatsapp":
    case "sms":
      return { phone: input.phone };
    case "push":
      return { pushToken: input.pushToken, platform: input.platform };
  }
}

/** A safe, non-secret label to show in the UI for an existing channel. */
export function maskChannel(type: DeliverableChannel | "email", config: ChannelConfig): string {
  if ("phone" in config) {
    const p = config.phone;
    return p.length > 4 ? `••••${p.slice(-4)}` : p;
  }
  if ("webhookUrl" in config) return "hooks.slack.com/…";
  if ("pushToken" in config) return `${type} device`;
  return type;
}

export const CHANNEL_LABELS: Record<DeliverableChannel, string> = {
  slack: "Slack",
  whatsapp: "WhatsApp",
  sms: "SMS",
  push: "Mobile push",
};
