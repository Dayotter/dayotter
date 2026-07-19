import type Anthropic from "@anthropic-ai/sdk";
import { MODELS, anthropicClient } from "./providers/anthropic";
import { aiEnabled, provider, supportsAgentTools } from "./providers/index";
import type { Effort, ModelTier } from "./providers/types";

/**
 * The single LLM layer for the whole platform. Every AI feature goes through
 * here - no feature instantiates its own client or picks its own model. The
 * actual vendor lives behind a provider abstraction (`./providers`) selected by
 * `AI_PROVIDER`, so this facade is vendor-agnostic: Otter runs on Claude, OpenAI,
 * or any OpenAI-compatible endpoint without any feature module changing.
 */

export { aiEnabled, supportsAgentTools, MODELS };
export type { ModelTier, Effort };

export interface ExtractOptions<T> {
  /** System prompt - set the assistant's scope and rules here. Keep it static so it caches. */
  system: string;
  /** The user's request / the content to interpret. */
  user: string;
  /** Retained for back-compat / logging; not sent to the API. */
  toolName?: string;
  toolDescription?: string;
  /** JSON Schema for the output. The reply is constrained to it. */
  inputSchema: Record<string, unknown>;
  /** Validate/narrow the raw output into `T` (e.g. a Zod `.parse`). */
  parse: (input: unknown) => T;
  maxTokens?: number;
  /** Short label for logs. */
  feature: string;
  /** Model tier (default `deep`). Use `fast` for simple, latency-sensitive tasks. */
  tier?: ModelTier;
  /** Cache the system prompt where supported (default true). */
  cacheSystem?: boolean;
  /** Reasoning effort on the deep tier (default `medium`); providers ignore it if unsupported. */
  effort?: Effort;
}

/**
 * The platform's single structured-extraction primitive: prompt the model,
 * constrain the reply to a JSON schema, hand back a validated object. Works on
 * whichever provider is configured.
 */
export async function extract<T>(opts: ExtractOptions<T>): Promise<T> {
  const raw = await provider.extract({
    system: opts.system,
    user: opts.user,
    inputSchema: opts.inputSchema,
    feature: opts.feature,
    tier: opts.tier ?? "deep",
    maxTokens: opts.maxTokens,
    cacheSystem: opts.cacheSystem,
    effort: opts.effort,
  });
  return opts.parse(raw);
}

/**
 * Raw Anthropic client for the streaming agentic tool-use loop (the command bar).
 * That loop is Anthropic-specific; throws a clear error if a different provider
 * is active so the caller can degrade to the vendor-agnostic command path.
 */
export function getAnthropicClient(): Anthropic {
  if (provider.name !== "anthropic") {
    throw new Error(
      "The conversational command bar requires the Anthropic provider (set AI_PROVIDER=anthropic).",
    );
  }
  return anthropicClient();
}
