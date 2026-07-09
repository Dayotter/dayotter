import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@calsync/core";
import { managedAnthropicKey } from "../ee/managed-ai";

/**
 * The single LLM layer for the whole platform. Every AI feature goes through
 * here — no feature instantiates its own client, picks its own model, or hand-
 * rolls its own request. This centralizes: model tiering, the API key gate,
 * structured-extraction mechanics (forced tool-use → validated object),
 * chain-of-thought, prompt caching, streaming, error handling, and logging.
 * Add a capability here; consume it from feature modules.
 */

/**
 * The key the platform uses. Self-host: the operator's own `ANTHROPIC_API_KEY`.
 * Cloud: falls back to calSync's managed key (the cloud-only "Managed AI"
 * feature) so Pro customers don't bring their own.
 */
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || managedAnthropicKey;

/** AI is optional platform-wide — nothing calls out unless a key is available. */
export const aiEnabled = Boolean(ANTHROPIC_KEY);

/**
 * Model tiers. Pick per task, not per feature:
 * - `deep` — highest quality, for genuine reasoning (planning a reschedule,
 *   resolving an ambiguous request, drafting a message).
 * - `fast` — low-latency + low-cost, for simple, well-bounded extraction or
 *   classification (parse a date, pick accept/decline). "Fast inference."
 * Change the actual model string in exactly one place.
 */
export const MODELS = {
  deep: "claude-opus-4-8",
  fast: "claude-haiku-4-5",
} as const;
export type ModelTier = keyof typeof MODELS;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  return client;
}

/**
 * Build the `system` param. When cached, the (large, static) system prompt is
 * marked with `cache_control` so repeated calls with the same prompt read it
 * from cache — lower latency and ~10× cheaper on the cached prefix. Keep the
 * system prompt static (no per-request timestamps) for the cache to hit.
 */
function buildSystem(system: string, cache: boolean): string | Anthropic.TextBlockParam[] {
  if (!cache) return system;
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

export interface ExtractOptions<T> {
  /** System prompt — set the assistant's scope and rules here. Keep it static so it caches. */
  system: string;
  /** The user's request / the content to interpret. */
  user: string;
  /** Name of the output tool (Claude is forced to call it). */
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool input. Put a leading `reasoning` field first for chain-of-thought. */
  inputSchema: Record<string, unknown>;
  /** Validate/narrow the raw tool input into `T` (e.g. a Zod `.parse`). */
  parse: (input: unknown) => T;
  maxTokens?: number;
  /** Short label for logs. */
  feature: string;
  /** Model tier (default `deep`). Use `fast` for simple, latency-sensitive tasks. */
  tier?: ModelTier;
  /** Cache the system prompt (default true). Disable only for tiny/one-off prompts. */
  cacheSystem?: boolean;
}

/**
 * The platform's single structured-extraction primitive: prompt Claude, force
 * it to return data matching a schema, and hand back a validated object. Used
 * by every AI feature that needs structured output.
 *
 * Chain-of-thought: because tool use is forced, put a `reasoning` string as the
 * FIRST property of `inputSchema` and instruct the model (in `system`) to fill
 * it first. The model reasons in that field before committing to the answer
 * fields — better results, and the reasoning is loggable. (This is the
 * SDK-portable way to get CoT alongside guaranteed structured output.)
 */
export async function extract<T>(opts: ExtractOptions<T>): Promise<T> {
  const model = MODELS[opts.tier ?? "deep"];
  const started = Date.now();
  const response = await getClient().messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: buildSystem(opts.system, opts.cacheSystem !== false),
    tools: [
      {
        name: opts.toolName,
        description: opts.toolDescription,
        input_schema: opts.inputSchema as unknown as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: opts.toolName },
    messages: [{ role: "user", content: opts.user }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    logger.error("llm returned no structured result", {
      event: "llm_no_result",
      feature: opts.feature,
      model,
    });
    throw new Error("The assistant did not return a result");
  }
  logger.info("llm extract", {
    event: "llm_extract",
    feature: opts.feature,
    model,
    ms: Date.now() - started,
    inputTokens: response.usage.input_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    outputTokens: response.usage.output_tokens,
  });
  return opts.parse(toolUse.input);
}

export interface GenerateOptions {
  system: string;
  user: string;
  maxTokens?: number;
  feature: string;
  tier?: ModelTier;
  cacheSystem?: boolean;
}

/**
 * Generate free-form text. Streams under the hood (so long outputs never hit an
 * HTTP timeout) and returns the concatenated text. Use for drafting where the
 * output is prose rather than a fixed schema.
 */
export async function generateText(opts: GenerateOptions): Promise<string> {
  const model = MODELS[opts.tier ?? "deep"];
  const stream = getClient().messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 1024,
    system: buildSystem(opts.system, opts.cacheSystem !== false),
    messages: [{ role: "user", content: opts.user }],
  });
  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/** Re-exported so the agent loop can build tool-use requests against the shared client + tiers. */
export { getClient as getAnthropicClient };
