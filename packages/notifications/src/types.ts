/** Channel kinds that can receive a notification (mirrors the DB enum, minus email
 *  which is delivered through @dayotter/emails). */
export type DeliverableChannel = "slack" | "whatsapp" | "sms" | "push" | "webpush";

/** A browser Web Push subscription (PushSubscription.toJSON() shape). */
export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** A short, calendar-scoped notification. `url` deep-links to the booking. */
export interface NotificationMessage {
  title: string;
  body: string;
  url?: string;
}

/** Per-channel destination config, stored encrypted in notification_channels.encryptedConfig. */
export type ChannelConfig =
  | { webhookUrl: string } // slack - a per-user Slack incoming webhook
  | { phone: string } // whatsapp / sms - E.164 phone number
  | { pushToken: string; platform?: "ios" | "android" } // push - Expo push token
  | { subscription: WebPushSubscription }; // webpush - browser Push subscription

export interface DispatchResult {
  ok: boolean;
  /** Why a dispatch was skipped (provider not configured) or failed. */
  reason?: string;
}
