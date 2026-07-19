import { type ChatEvent, type ChatTurn, streamAssistant } from "@/lib/ai/chat";
import { SCOPE_REFUSAL, latestUserText, screenUserInput } from "@/lib/ai/guardrails";
import { aiEnabled, supportsAgentTools } from "@/lib/ai/llm";
import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { z } from "zod";

export const dynamic = "force-dynamic";
// Streaming needs the Node runtime (not edge) - the Anthropic SDK + DB access.
export const runtime = "nodejs";

const body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    // Keep the last ~16 turns so a long thread can't blow the context/token budget.
    .max(16),
});

/**
 * Conversational scheduling assistant - streams the reply token-by-token over
 * SSE, and emits a confirm-first `action` event when it proposes a calendar
 * change. Read-only: it never writes; the client confirms via the write
 * endpoints. Reuses the same AI layer + retrieval as the quick-add command bar.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);
  // The streaming, multi-turn command bar uses provider-native tool-use, which is
  // Anthropic-only today. Other providers still power the quick command bar and
  // every other AI feature (they go through the vendor-agnostic `extract`).
  if (!supportsAgentTools) {
    return jsonError(
      "The conversational assistant needs the Anthropic provider. Use the quick command instead.",
      503,
    );
  }
  const gate = await requireFeature(u.id, "ai");
  if (gate) return gate;

  const limited = await enforceRateLimit(request, {
    name: "ai-chat",
    limit: 40,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Say something to the assistant.", 400);
  const turns = parsed.data.messages as ChatTurn[];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        // Guardrail: block blatant injection/jailbreak before spending a model call.
        if (screenUserInput(latestUserText(turns), { userId: u.id }).blocked) {
          send({ type: "token", text: SCOPE_REFUSAL });
          send({ type: "done", text: SCOPE_REFUSAL });
        } else {
          await streamAssistant({ userId: u.id, turns, emit: send });
        }
      } catch (err) {
        logger.error("ai chat stream failed", { event: "ai_chat_failed", userId: u.id, err });
        send({ type: "error", message: "The assistant hit a snag. Please try again." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
});
