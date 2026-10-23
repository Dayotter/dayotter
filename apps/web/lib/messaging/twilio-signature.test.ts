import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { twilioWebhookUrl, validTwilioSignature } from "./twilio-signature";

const TOKEN = "test_auth_token_123";

/** Sign exactly as Twilio does: url + each param (key+value) in key order, HMAC-SHA1, base64. */
function sign(url: string, params: Record<string, string>, token = TOKEN): string {
  let data = url;
  for (const k of Object.keys(params).sort()) data += k + params[k];
  return createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
}

describe("validTwilioSignature", () => {
  const url = "https://app.example.com/api/webhooks/twilio/sms";
  const params = { From: "+15551234567", Body: "hi there", To: "+15557654321" };

  beforeEach(() => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", TOKEN);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a correctly signed request", () => {
    const sig = sign(url, params);
    expect(validTwilioSignature(url, new URLSearchParams(params), sig)).toBe(true);
  });

  it("validates regardless of param insertion order (Twilio sorts by key)", () => {
    const sig = sign(url, params);
    const shuffled = new URLSearchParams();
    shuffled.set("To", params.To);
    shuffled.set("Body", params.Body);
    shuffled.set("From", params.From);
    expect(validTwilioSignature(url, shuffled, sig)).toBe(true);
  });

  it("rejects a tampered parameter", () => {
    const sig = sign(url, params);
    const tampered = new URLSearchParams({ ...params, Body: "malicious" });
    expect(validTwilioSignature(url, tampered, sig)).toBe(false);
  });

  it("rejects a signature made for a different URL", () => {
    const sig = sign("https://evil.example.com/api/webhooks/twilio/sms", params);
    expect(validTwilioSignature(url, new URLSearchParams(params), sig)).toBe(false);
  });

  it("rejects a signature made with the wrong auth token", () => {
    const sig = sign(url, params, "wrong_token");
    expect(validTwilioSignature(url, new URLSearchParams(params), sig)).toBe(false);
  });

  it("fails closed when the signature header is missing", () => {
    expect(validTwilioSignature(url, new URLSearchParams(params), null)).toBe(false);
  });

  it("fails closed when no auth token is configured", () => {
    vi.stubEnv("TWILIO_AUTH_TOKEN", undefined);
    const sig = sign(url, params);
    expect(validTwilioSignature(url, new URLSearchParams(params), sig)).toBe(false);
  });

  it("does not throw on a malformed (different-length) signature", () => {
    expect(validTwilioSignature(url, new URLSearchParams(params), "short")).toBe(false);
  });
});

describe("twilioWebhookUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers TWILIO_WEBHOOK_URL as the signed base", () => {
    vi.stubEnv("TWILIO_WEBHOOK_URL", "https://public.example.com");
    expect(twilioWebhookUrl("/api/webhooks/twilio/sms", "http://internal/ignored")).toBe(
      "https://public.example.com/api/webhooks/twilio/sms",
    );
  });

  it("falls back to APP_URL when no webhook URL is set", () => {
    vi.stubEnv("TWILIO_WEBHOOK_URL", undefined);
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(twilioWebhookUrl("/api/webhooks/twilio/voice", "http://internal/ignored")).toBe(
      "https://app.example.com/api/webhooks/twilio/voice",
    );
  });

  it("falls back to the request URL when nothing is configured", () => {
    vi.stubEnv("TWILIO_WEBHOOK_URL", undefined);
    vi.stubEnv("APP_URL", undefined);
    expect(twilioWebhookUrl("/api/webhooks/twilio/sms", "https://req.example.com/x")).toBe(
      "https://req.example.com/x",
    );
  });
});
