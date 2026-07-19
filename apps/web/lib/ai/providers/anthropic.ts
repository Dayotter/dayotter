import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@dayotter/core";
import { managedAnthropicKey } from "../../ee/managed-ai";
import type { ExtractRequest, LlmProvider, ModelTier } from "./types";

/**
 * Anthropic (Claude) provider - the default. Structured extraction uses the
 * native structured-outputs `output_config` plus adaptive thinking on the deep
 * tier. This is also the only provider that backs the streaming agentic tool-use
 * loop (the command bar) today, so it exposes its raw client.
 */

const KEY = process.env.ANTHROPIC_API_KEY || managedAnthropicKey;

/** Anthropic models per tier. Also used by the agentic tool-use loop, which is
 *  Anthropic-only, so it reads these directly. */
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
};
