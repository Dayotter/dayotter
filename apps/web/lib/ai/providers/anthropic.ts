import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@dayotter/core";
import { managedAnthropicKey } from "../../ee/managed-ai";
import type {
  AgentStepRequest,
  AgentStepResult,
  AgentTurn,
  ExtractRequest,
  LlmProvider,
  ModelTier,
} from "./types";

/**
 * Anthropic (Claude) provider - the default. Structured extraction uses the
 * native structured-outputs `output_config` plus adaptive thinking on the deep
 * tier; `streamAgentStep` backs the streaming agentic tool-use loop (the command
 * bar) with native tool use + prompt caching. It also exposes its raw client.
 */

const KEY = process.env.ANTHROPIC_API_KEY || managedAnthropicKey;

/** Anthropic models per tier, keyed by the neutral `ModelTier`. */
export const MODELS: Record<ModelTier, string> = {
  deep: process.env.ANTHROPIC_MODEL_DEEP || "claude-opus-4-8",
  fast: process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5",
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: KEY });
  return client;
}

/** Raw client for the agentic tool-use loop (lib/ai/chat.ts, agent.ts). */
export function anthropicClient(): Anthropic {
  return getClient();
}

function buildSystem(system: string, cache: boolean): string | Anthropic.TextBlockParam[] {
  if (!cache) return system;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

/** Map the neutral agent history into Anthropic message params. */
function toAnthropicMessages(history: AgentTurn[]): Anthropic.MessageParam[] {
  return history.map((turn): Anthropic.MessageParam => {
    switch (turn.role) {
      case "user":
        return { role: "user", content: turn.text };
      case "assistant":
        return { role: "assistant", content: turn.text };
      case "assistant_raw":
        // The exact content blocks from a prior tool-use step (incl. thinking),
        // echoed back verbatim as required for multi-turn tool use.
        return { role: "assistant", content: turn.raw as Anthropic.ContentBlockParam[] };
      case "tool_results":
        return {
          role: "user",
          content: turn.results.map(
            (r): Anthropic.ToolResultBlockParam => ({
              type: "tool_result",
              tool_use_id: r.id,
              content: r.content,
            }),
          ),
        };
    }
  });
}

export const anthropicProvider: LlmProvider = {
  name: "anthropic",
  configured: Boolean(KEY),
  supportsAgentTools: true,

  async extract(req: ExtractRequest): Promise<unknown> {
    const deep = req.tier === "deep";
    const model = MODELS[req.tier];
    const started = Date.now();

    const response = await getClient().messages.create({
      model,
      // Adaptive thinking shares the budget with the output; give the deep tier
      // headroom above the small JSON so heavy reasoning can't truncate it.
      max_tokens: req.maxTokens ?? (deep ? 4096 : 1024),
      system: buildSystem(req.system, req.cacheSystem !== false),
      output_config: {
        format: { type: "json_schema", schema: req.inputSchema },
        ...(deep ? { effort: req.effort ?? "medium" } : {}),
      },
      ...(deep ? { thinking: { type: "adaptive" as const } } : {}),
      messages: [{ role: "user", content: req.user }],
    });

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      logger.error("llm returned no structured result", {
        event: "llm_no_result",
        provider: "anthropic",
        feature: req.feature,
        model,
        stopReason: response.stop_reason,
      });
      throw new Error("The assistant did not return a result");
    }
    logger.info("llm extract", {
      event: "llm_extract",
      provider: "anthropic",
      feature: req.feature,
      model,
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      outputTokens: response.usage.output_tokens,
    });
    return JSON.parse(text.text) as unknown;
  },

  async streamAgentStep(req: AgentStepRequest): Promise<AgentStepResult> {
    const deep = req.tier === "deep";
    const system: Anthropic.TextBlockParam[] = req.system.map((b) =>
      b.cache
        ? { type: "text", text: b.text, cache_control: { type: "ephemeral" } }
        : { type: "text", text: b.text },
    );

    const stream = getClient().messages.stream({
      model: MODELS[req.tier],
      max_tokens: req.maxTokens ?? 3000,
      system,
      tools: req.tools.map(
        (t): Anthropic.Tool => ({
          name: t.name,
          description: t.description,
          input_schema: t.schema as Anthropic.Tool.InputSchema,
        }),
      ),
      tool_choice: { type: "auto" },
      // Adaptive thinking + effort on the deep tier so the model reasons across
      // tool results before answering; the fast tier omits both (unsupported).
      ...(deep
        ? {
            output_config: { effort: req.effort ?? "medium" },
            thinking: { type: "adaptive" as const },
          }
        : {}),
      messages: toAnthropicMessages(req.history),
    });

    let text = "";
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
        text += ev.delta.text;
        req.onToken?.(ev.delta.text);
      }
    }

    const final = await stream.finalMessage();
    const toolCalls = final.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({ id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> }));

    return { text, toolCalls, assistant: final.content };
  },
};
