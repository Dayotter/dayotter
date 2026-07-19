/**
 * Vendor-agnostic LLM provider contract. The platform's single AI layer
 * (`lib/ai/llm.ts`) talks to whichever provider is configured (`AI_PROVIDER`),
 * so Otter can run on Claude, OpenAI, or any OpenAI-compatible endpoint
 * (Groq, OpenRouter, Azure OpenAI, a local Ollama/LM Studio, ...) without any
 * feature module knowing which vendor is behind it.
 */

/** Model tiers - pick per task, not per feature. `deep` = quality/reasoning,
 *  `fast` = low-latency/low-cost classification+extraction. */
export type ModelTier = "deep" | "fast";

/** Reasoning effort on the deep tier (providers that don't support it ignore it). */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ExtractRequest {
  system: string;
  user: string;
  /** JSON Schema the output must conform to. */
  inputSchema: Record<string, unknown>;
  /** Short label for logs. */
  feature: string;
  tier: ModelTier;
  maxTokens?: number;
  /** Cache the (static) system prompt where the provider supports it. */
  cacheSystem?: boolean;
  effort?: Effort;
}

export interface LlmProvider {
  /** Stable id, e.g. "anthropic" | "openai". */
  readonly name: string;
  /** Whether a usable API key/config is present for this provider. */
  readonly configured: boolean;
  /**
   * Whether this provider backs the streaming, multi-turn agentic tool-use loop
   * (the Otter command bar / `lib/ai/chat.ts`). Structured `extract` works on
   * every provider; the live agent loop is currently Anthropic-only.
   */
  readonly supportsAgentTools: boolean;
  /**
   * Structured extraction: prompt the model, constrain the reply to `inputSchema`,
   * and return the raw parsed JSON object (the caller validates/narrows it).
   */
  extract(req: ExtractRequest): Promise<unknown>;
}
