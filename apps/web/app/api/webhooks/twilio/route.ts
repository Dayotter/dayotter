import { createHmac, timingSafeEqual } from "node:crypto";
import { aiEnabled } from "@/lib/ai/llm";
import { userHasFeature } from "@/lib/billing/entitlements";
import { type PendingAction, executePending, interpretForSms } from "@/lib/messaging/otter-sms";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { connection } from "@dayotter/jobs";

export const dynamic = "force-dynamic";

const PENDING_PREFIX = "otter:sms:pending:";
const PENDING_TTL = 600; // 10 minutes to confirm
const RL_PREFIX = "otter:sms:rl:";
const RL_LIMIT = 20;
const RL_WINDOW = 300;

const YES = new Set(["yes", "y", "ok", "okay", "confirm", "yep", "sure", "👍"]);
const NO = new Set(["no", "n", "cancel", "stop", "nope"]);

function xmlEscape(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );
}

/** A TwiML response — Twilio delivers the <Message> back on the same channel. */
function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xmlEscape(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

/**
 * Validate Twilio's request signature. Twilio signs the exact public webhook URL
 * plus the POST params (sorted by key, concatenated), HMAC-SHA1 with the auth
 * token, base64. See twilio.com/docs/usage/security.
 */
function validSignature(url: string, params: URLSearchParams, signature: string | null): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false;
  const sorted = [...params.keys()].sort();
  let data = url;
  for (const k of sorted) data += k + params.get(k);
  const expected = createHmac("sha1", token).update(Buffer.from(data, "utf-8")).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function rateLimited(userId: string): Promise<boolean> {
  const key = `${RL_PREFIX}${userId}`;
  const n = await connection.incr(key);
  if (n === 1) await connection.expire(key, RL_WINDOW);
  return n > RL_LIMIT;
}

/**
 * Inbound WhatsApp/SMS → Otter. Twilio POSTs form-encoded params here; we verify
 * the signature, map the sender's number to a DayOtter user, and let Otter
 * interpret the message — confirm-first, via a "reply YES" step for any write.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const params = new URLSearchParams(raw);

  // Validate against the canonical public URL (what Twilio was configured with).
  const base = process.env.TWILIO_WEBHOOK_URL ?? process.env.APP_URL ?? "";
  const url = base ? new URL("/api/webhooks/twilio", base).toString() : request.url;
  if (!validSignature(url, params, request.headers.get("x-twilio-signature"))) {
    logger.warn("twilio signature rejected", { event: "twilio_sig_rejected" });
    return new Response("Forbidden", { status: 403 });
  }

  const from = (params.get("From") ?? "").replace(/^whatsapp:/, "").trim();
  const body = (params.get("Body") ?? "").trim();
  if (!from || !body) return twiml();

  // Map the sender's verified phone number to a user.
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.phoneNumber, from),
    columns: { id: true, phoneNumberVerified: true },
  });
  if (!user || !user.phoneNumberVerified) {
    return twiml(
      "I don't recognize this number. Add and verify it in DayOtter → Settings to chat with Otter.",
    );
  }

  if (!aiEnabled || !(await userHasFeature(user.id, "ai"))) {
    return twiml(
      "Otter isn't available on your plan. Upgrade in DayOtter to chat with your assistant.",
    );
  }
  if (await rateLimited(user.id)) {
    return twiml("You're going a bit fast — give me a minute and try again.");
  }

  const pendingKey = `${PENDING_PREFIX}${user.id}`;
  const word = body.toLowerCase();

  // Confirmation step for a previously-proposed action.
  if (YES.has(word) || NO.has(word)) {
    const stored = await connection.getdel(pendingKey);
    if (!stored) return twiml("Nothing's waiting to confirm. Tell me what you'd like to schedule.");
    if (NO.has(word)) return twiml("Okay — I won't do that.");
    const pending = JSON.parse(stored) as PendingAction;
    return twiml(await executePending(user.id, pending));
  }

  // Fresh request → interpret with Otter.
  try {
    const result = await interpretForSms(user.id, body);
    if (result.pending) {
      await connection.set(pendingKey, JSON.stringify(result.pending), "EX", PENDING_TTL);
    }
    return twiml(result.reply);
  } catch (err) {
    logger.error("otter sms interpret failed", { event: "otter_sms_failed", userId: user.id, err });
    return twiml("I couldn't work that out. Try rephrasing, or use the app.");
  }
}
