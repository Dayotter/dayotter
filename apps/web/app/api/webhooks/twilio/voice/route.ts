import { aiEnabled } from "@/lib/ai/llm";
import { twilioWebhookUrl, validTwilioSignature } from "@/lib/messaging/twilio-signature";
import { buildKnowledge } from "@/lib/voice/knowledge";
import { type VoiceTurn, handleVoiceTurn } from "@/lib/voice/receptionist";
import { resolveVoiceHost } from "@/lib/voice/resolver";
import { sayAndGather, sayAndHangup } from "@/lib/voice/twiml";
import { logger } from "@dayotter/core";
import { connection } from "@dayotter/jobs";
import { sendTextSms } from "@dayotter/notifications";

export const dynamic = "force-dynamic";

const ACTION_PATH = "/api/webhooks/twilio/voice";
const STATE_PREFIX = "voice:call:";
const STATE_TTL = 60 * 60; // 1h
const MAX_TURNS = 12;

interface CallState {
  hostUserId: string;
  hostName: string;
  bookingUrl: string | null;
  knowledge: string;
  history: VoiceTurn[];
}

/**
 * AI voice receptionist. Twilio hits this when a call connects (no speech yet →
 * greet) and again after each `<Gather>` (with SpeechResult). We keep the
 * conversation in Redis per CallSid, ground each reply in the host's knowledge,
 * and can text the caller a booking link. Confirm-first stays intact: the
 * receptionist never books on its own - it hands the caller a link to choose.
 */
export async function POST(request: Request): Promise<Response> {
  const raw = await request.text();
  const params = new URLSearchParams(raw);

  const url = twilioWebhookUrl(ACTION_PATH, request.url);
  if (!validTwilioSignature(url, params, request.headers.get("x-twilio-signature"))) {
    logger.warn("twilio voice signature rejected", { event: "twilio_voice_sig_rejected" });
    return new Response("Forbidden", { status: 403 });
  }

  const callSid = params.get("CallSid") ?? "";
  const from = params.get("From") ?? "";
  const to = params.get("To") ?? "";
  const speech = (params.get("SpeechResult") ?? "").trim();
  if (!callSid) return sayAndHangup("Sorry, something went wrong. Goodbye.");

  const stateKey = `${STATE_PREFIX}${callSid}`;
  const stored = await connection.get(stateKey);
  let state: CallState | null = stored ? (JSON.parse(stored) as CallState) : null;

  // First hit for this call → greet.
  if (!state) {
    const host = await resolveVoiceHost(to);
    if (!host) return sayAndHangup("Sorry, this number isn't set up to take calls yet. Goodbye.");
    if (!aiEnabled) {
      return sayAndHangup(
        `Thanks for calling ${host.name}. Our assistant is offline right now - please try again later.`,
      );
    }
    const knowledge = await buildKnowledge(host);
    state = {
      hostUserId: host.userId,
      hostName: host.name,
      bookingUrl: host.bookingUrl,
      knowledge,
      history: [],
    };
    const greeting = `Hi, thanks for calling ${host.name}. I can answer a few questions or help you book a time - what can I do for you?`;
    state.history.push({ role: "receptionist", text: greeting });
    await connection.set(stateKey, JSON.stringify(state), "EX", STATE_TTL);
    return sayAndGather(greeting, ACTION_PATH);
  }

  // No speech captured (silence / no-input redirect) → gently re-prompt.
  if (!speech) {
    return sayAndGather("Sorry, I didn't catch that. What can I help you with?", ACTION_PATH);
  }

  // Guard against a runaway loop.
  if (state.history.filter((t) => t.role === "caller").length >= MAX_TURNS) {
    return sayAndHangup("Let's pick this up another time - thanks for calling. Goodbye.");
  }

  state.history.push({ role: "caller", text: speech });

  let reply = "Let me have someone follow up with you.";
  let next: "listen" | "hangup" | "send_booking_link" = "listen";
  try {
    const turn = await handleVoiceTurn({
      host: {
        userId: state.hostUserId,
        name: state.hostName,
        handle: null,
        timezone: "UTC",
        bookingUrl: state.bookingUrl,
      },
      knowledge: state.knowledge,
      history: state.history,
      speech,
    });
    reply = turn.reply;
    next = turn.next;
  } catch (err) {
    logger.error("voice turn failed", { event: "voice_turn_failed", callSid, err });
  }

  state.history.push({ role: "receptionist", text: reply });
  await connection.set(stateKey, JSON.stringify(state), "EX", STATE_TTL);

  // Action handlers. Add a case here to extend `VoiceNext`.
  if (next === "send_booking_link" && state.bookingUrl && from) {
    await sendTextSms(from, `Book with ${state.hostName}: ${state.bookingUrl}`).catch(
      (err: unknown) =>
        logger.error("voice booking sms failed", { event: "voice_sms_failed", callSid, err }),
    );
  }
  if (next === "hangup") {
    await connection.del(stateKey);
    return sayAndHangup(reply);
  }
  return sayAndGather(reply, ACTION_PATH);
}
