import { isCloud } from "../billing/edition";

/**
 * Hosted messaging — cloud-only. dayotter Cloud sends SMS/WhatsApp reminders
 * through dayotter's own Twilio account (with included credits) so Pro customers
 * don't wire up their own. Self-hosters set their own `TWILIO_*` env.
 */
export const hostedTwilioCreds = isCloud
  ? {
      accountSid: process.env.CALSYNC_MANAGED_TWILIO_SID ?? "",
      authToken: process.env.CALSYNC_MANAGED_TWILIO_TOKEN ?? "",
      smsFrom: process.env.CALSYNC_MANAGED_TWILIO_SMS_FROM ?? "",
      whatsappFrom: process.env.CALSYNC_MANAGED_TWILIO_WA_FROM ?? "",
    }
  : null;

export const hostedMessagingAvailable = isCloud && Boolean(hostedTwilioCreds?.accountSid);
