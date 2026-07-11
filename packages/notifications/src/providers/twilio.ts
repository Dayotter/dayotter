import { logger } from "@dayotter/core";
import type { DispatchResult, NotificationMessage } from "../types";

/**
 * WhatsApp + SMS via Twilio. Env-gated: no-ops (skipped) when the server has no
 * Twilio credentials, so self-hosters without a Twilio account are unaffected.
 *
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN  — account credentials
 *   TWILIO_WHATSAPP_FROM                    — e.g. "whatsapp:+14155238886"
 *   TWILIO_SMS_FROM                         — e.g. "+14155238886"
 */
export function twilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

function bodyText(message: NotificationMessage): string {
  const parts = [message.title, message.body];
  if (message.url) parts.push(message.url);
  return parts.join("\n");
}

async function sendViaTwilio(from: string, to: string, body: string): Promise<DispatchResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return { ok: false, reason: "not_configured" };

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ From: from, To: to, Body: body });

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    if (!res.ok) {
      logger.warn("twilio dispatch failed", {
        event: "twilio_dispatch_failed",
        status: res.status,
      });
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    logger.error("twilio dispatch error", { event: "twilio_dispatch_error", err });
    return { ok: false, reason: "network" };
  }
}

export async function sendWhatsApp(
  phone: string,
  message: NotificationMessage,
): Promise<DispatchResult> {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!twilioConfigured() || !from) return { ok: false, reason: "not_configured" };
  return sendViaTwilio(from, `whatsapp:${phone}`, bodyText(message));
}

export async function sendSms(
  phone: string,
  message: NotificationMessage,
): Promise<DispatchResult> {
  const from = process.env.TWILIO_SMS_FROM;
  if (!twilioConfigured() || !from) return { ok: false, reason: "not_configured" };
  return sendViaTwilio(from, phone, bodyText(message));
}
