import { logger } from "@dayotter/core";
import OpenAI from "openai";
import type {
  AgentStepRequest,
  AgentStepResult,
  AgentTurn,
  ExtractRequest,
  LlmProvider,
  ModelTier,
} from "./types";

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
 *
 * The streaming agentic loop (`streamAgentStep`) uses the equally portable Chat
 * Completions function-calling: stream `delta.content` as tokens and accumulate
 * `delta.tool_calls` deltas by index, then hand the parsed calls back to the
 * caller (which runs them and loops). The prompt-caching / adaptive-thinking
 * knobs the Anthropic provider uses don't apply here, so they're ignored.
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

/** Map the neutral agent history into OpenAI chat messages. */
function toOpenAiMessages(
  system: AgentStepRequest["system"],
  history: AgentTurn[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system.map((b) => b.text).join("\n\n") },
  ];
  for (const turn of history) {
    switch (turn.role) {
      case "user":
        messages.push({ role: "user", content: turn.text });
        break;
      case "assistant":
        messages.push({ role: "assistant", content: turn.text });
        break;
      case "assistant_raw":
        // The stored assistant message (may carry tool_calls) from a prior step.
        messages.push(turn.raw as OpenAI.Chat.ChatCompletionAssistantMessageParam);
        break;
      case "tool_results":
        // Each result is its own `role: "tool"` message keyed by the call id.
        for (const r of turn.results) {
          messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
        }
        break;
    }
  }
  return messages;
}

export const openaiProvider: LlmProvider = {
  name: "openai",
  configured: Boolean(KEY),
  supportsAgentTools: true,

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

  async streamAgentStep(req: AgentStepRequest): Promise<AgentStepResult> {
    const model = MODELS[req.tier];
    const stream = await getClient().chat.completions.create({
      model,
      messages: toOpenAiMessages(req.system, req.history),
      tools: req.tools.map(
        (t): OpenAI.Chat.ChatCompletionTool => ({
          type: "function",
          function: { name: t.name, description: t.description, parameters: t.schema },
        }),
      ),
      tool_choice: "auto",
      max_tokens: req.maxTokens ?? 3000,
      stream: true,
    });

    let text = "";
    // Accumulate streamed tool-call deltas by their `index` - id and name arrive
    // once, arguments arrive as a stream of string fragments to be concatenated.
    const partial: { id: string; name: string; args: string }[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        text += delta.content;
        req.onToken?.(delta.content);
      }
      for (const tc of delta?.tool_calls ?? []) {
        let slot = partial[tc.index];
        if (!slot) {
          slot = { id: "", name: "", args: "" };
          partial[tc.index] = slot;
        }
        if (tc.id) slot.id = tc.id;
        if (tc.function?.name) slot.name += tc.function.name;
        if (tc.function?.arguments) slot.args += tc.function.arguments;
      }
    }

    const calls = partial.filter((c) => c?.name);
    const toolCalls = calls.map((c) => {
      let input: Record<string, unknown> = {};
      try {
        input = c.args ? (JSON.parse(c.args) as Record<string, unknown>) : {};
      } catch {
        logger.warn("openai tool-call args not valid JSON", {
          event: "ai_openai_toolargs_parse_failed",
          tool: c.name,
        });
      }
      return { id: c.id, name: c.name, input };
    });

    // The assistant turn to echo back next step, in OpenAI's own shape.
    const assistant: OpenAI.Chat.ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: text || null,
      ...(calls.length
        ? {
            tool_calls: calls.map(
              (c): OpenAI.Chat.ChatCompletionMessageToolCall => ({
                id: c.id,
                type: "function",
                function: { name: c.name, arguments: c.args || "{}" },
              }),
            ),
          }
        : {}),
    };

    return { text, toolCalls, assistant };
  },
};
