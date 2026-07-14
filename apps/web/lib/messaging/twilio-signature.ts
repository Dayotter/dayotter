import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Validate Twilio's request signature (webhooks.ts algorithm): the exact public
 * webhook URL + the POST params sorted by key and concatenated, HMAC-SHA1 with
 * the auth token, base64. Shared by the SMS and Voice webhooks. Fail-closed.
 */
export function validTwilioSignature(
  url: string,
  params: URLSearchParams,
  signature: string | null,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  let data = url;
  for (const k of [...params.keys()].sort()) data += k + params.get(k);
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The canonical public URL Twilio signed (configurable; falls back to request). */
export function twilioWebhookUrl(path: string, requestUrl: string): string {
  const base = process.env.TWILIO_WEBHOOK_URL ?? process.env.APP_URL ?? "";
  return base ? new URL(path, base).toString() : requestUrl;
}
