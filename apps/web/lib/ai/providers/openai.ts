import { logger } from "@dayotter/core";
import OpenAI from "openai";
import type { ExtractRequest, LlmProvider, ModelTier } from "./types";

/**
 * OpenAI-compatible provider. Works with OpenAI itself and with any endpoint
 * that speaks the OpenAI Chat Completions API - Groq, OpenRouter, Together,
 * Azure OpenAI, a local Ollama / LM Studio, etc. - by pointing `OPENAI_BASE_URL`
 * at it. Models are env-configurable so you can name whatever the endpoint hosts.
 *
 * Structured output uses the portable path: request JSON-object mode and put the
 * JSON Schema in the system prompt, then JSON-parse the reply. (`json_object` is
 * supported almost everywhere; `json_schema` is OpenAI-specific.) The caller
 * still validates the object with its Zod schema, so a stray field is caught.
 */

const KEY = process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.OPENAI_BASE_URL || undefined;

const MODELS: Record<ModelTier, string> = {
  deep: process.env.OPENAI_MODEL_DEEP || "gpt-4.1",
  fast: process.env.OPENAI_MODEL_FAST || "gpt-4.1-mini",
};

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) client = new OpenAI({ apiKey: KEY, baseURL: BASE_URL });
  return client;
}

/** Strip ```json … ``` fences some models wrap around JSON. */
function unwrapJson(raw: string): string {
  const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m?.[1] ?? raw).trim();
}

export const openaiProvider: LlmProvider = {
  name: "openai",
  configured: Boolean(KEY),
  supportsAgentTools: false,

  async extract(req: ExtractRequest): Promise<unknown> {
    const model = MODELS[req.tier];
    const started = Date.now();
    const system = `${req.system}

Respond with a SINGLE JSON object and nothing else (no prose, no code fences).
It MUST conform to this JSON Schema:
${JSON.stringify(req.inputSchema)}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      { role: "user", content: req.user },
    ];

    // json_object mode isn't universal on OpenAI-compatible endpoints; if it's
    // rejected, retry without it (the schema-in-prompt still constrains output).
    let content: string | null = null;
    let usage: OpenAI.CompletionUsage | undefined;
    try {
      const c = await getClient().chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
      });
      content = c.choices[0]?.message?.content ?? null;
      usage = c.usage;
    } catch {
      const c = await getClient().chat.completions.create({ model, messages });
      content = c.choices[0]?.message?.content ?? null;
      usage = c.usage;
    }

    if (!content) {
      logger.error("llm returned no structured result", {
        event: "llm_no_result",
        provider: "openai",
        feature: req.feature,
        model,
      });
      throw new Error("The assistant did not return a result");
    }
    logger.info("llm extract", {
      event: "llm_extract",
      provider: "openai",
      feature: req.feature,
      model,
      ms: Date.now() - started,
      inputTokens: usage?.prompt_tokens ?? 0,
      outputTokens: usage?.completion_tokens ?? 0,
    });
    return JSON.parse(unwrapJson(content)) as unknown;
  },
};
