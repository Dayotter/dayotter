import { extract } from "@/lib/ai/llm";
import { z } from "zod";
import type { VoiceHost } from "./knowledge";

/** What the receptionist does after this turn. Add a value + a handler in the
 *  route to extend (e.g. "transfer" to dial the host). */
export type VoiceNext = "listen" | "hangup" | "send_booking_link";

export interface VoiceTurn {
  role: "caller" | "receptionist";
  text: string;
}

export interface VoiceTurnResult {
  reply: string;
  next: VoiceNext;
}

const turnSchema = z.object({
  reply: z.string(),
  next: z.enum(["listen", "hangup", "send_booking_link"]),
});

const inputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasoning: {
      type: "string",
      description: "One line: what the caller wants and how to respond.",
    },
    reply: {
      type: "string",
      description: "What to say back — short, natural for speech (1–2 sentences).",
    },
    next: {
      type: "string",
      enum: ["listen", "hangup", "send_booking_link"],
      description:
        "listen = keep talking; send_booking_link = caller wants to book, text them the link; hangup = caller is done.",
    },
  },
  required: ["reasoning", "reply", "next"],
} as const;

function systemPrompt(host: VoiceHost): string {
  return `You are the warm, efficient phone receptionist for ${host.name}. Callers phone in with questions or to book time.

Rules:
- Answer ONLY from the KNOWLEDGE provided. If you don't know, say you'll have ${host.name} follow up — never invent hours, prices, or availability.
- Keep replies SHORT and natural for speech — one or two sentences, no lists, no URLs read aloud.
- If the caller wants to book / make an appointment, set next = "send_booking_link" and tell them you'll text them a link to pick a time.
- If the caller is finished, thanks you, or says goodbye, set next = "hangup" with a brief sign-off.
- Otherwise set next = "listen" and keep helping.`;
}

function buildUser(knowledge: string, history: VoiceTurn[], speech: string): string {
  const convo = history
    .map((t) => `${t.role === "caller" ? "Caller" : "You"}: ${t.text}`)
    .join("\n");
  return `KNOWLEDGE:
${knowledge || "(no specific info on file — offer to have the host follow up)"}

CONVERSATION SO FAR:
${convo || "(this is the start of the call)"}

Caller just said: "${speech}"

Respond as the receptionist.`;
}

/**
 * Run one turn of the phone conversation. Fast tier for low latency (a caller is
 * waiting on the line). Grounded strictly in the host's knowledge.
 */
export async function handleVoiceTurn(params: {
  host: VoiceHost;
  knowledge: string;
  history: VoiceTurn[];
  speech: string;
}): Promise<VoiceTurnResult> {
  const result = await extract({
    feature: "voice-receptionist",
    tier: "fast",
    system: systemPrompt(params.host),
    user: buildUser(params.knowledge, params.history, params.speech),
    toolName: "respond",
    toolDescription: "Return the receptionist's spoken reply and what to do next.",
    inputSchema,
    parse: (input) => turnSchema.parse(input),
  });
  return { reply: result.reply, next: result.next };
}
