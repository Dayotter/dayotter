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

/**
 * A system-prompt block. `cache` asks the provider to cache this (static) block
 * where it can (Anthropic prompt caching); providers that can't just concatenate.
 */
export interface SystemBlock {
  text: string;
  cache?: boolean;
}

/** A tool the model may call, in vendor-neutral form. */
export interface AgentToolSpec {
  name: string;
  description: string;
  /** JSON Schema for the tool's input. */
  schema: Record<string, unknown>;
}

/** A tool call the model emitted (arguments already parsed from JSON). */
export interface AgentToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** The result of running one tool call, fed back to the model. */
export interface AgentToolResult {
  /** Must match the {@link AgentToolCall.id} it answers. */
  id: string;
  content: string;
}

/**
 * Vendor-neutral conversation history for the agentic loop. The caller owns this
 * list: it seeds `user`/`assistant` turns, then after each step pushes the
 * returned opaque `assistant` item (as `assistant_raw`) followed by a
 * `tool_results` item, and calls {@link LlmProvider.streamAgentStep} again.
 */
export type AgentTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  /** The provider-specific assistant message from a prior tool-use step, echoed back verbatim. */
  | { role: "assistant_raw"; raw: unknown }
  | { role: "tool_results"; results: AgentToolResult[] };

export interface AgentStepRequest {
  system: SystemBlock[];
  history: AgentTurn[];
  tools: AgentToolSpec[];
  tier: ModelTier;
  effort?: Effort;
  maxTokens?: number;
  /** Streamed assistant text deltas. Omit for a non-streaming (single-shot) call. */
  onToken?: (text: string) => void;
}

export interface AgentStepResult {
  /** The assistant's visible text this step. */
  text: string;
  /** Tool calls to run (empty ⇒ this is the final answer). */
  toolCalls: AgentToolCall[];
  /** Opaque assistant turn to echo back next step (push as `{ role: "assistant_raw", raw }`). */
  assistant: unknown;
}

export interface LlmProvider {
  /** Stable id, e.g. "anthropic" | "openai". */
  readonly name: string;
  /** Whether a usable API key/config is present for this provider. */
  readonly configured: boolean;
  /**
   * Whether this provider backs the streaming, multi-turn agentic tool-use loop
   * (the Otter command bar / `lib/ai/chat.ts`). Both the Anthropic and the
   * OpenAI-compatible providers do; a hypothetical tool-less provider would not.
   */
  readonly supportsAgentTools: boolean;
  /**
   * Structured extraction: prompt the model, constrain the reply to `inputSchema`,
   * and return the raw parsed JSON object (the caller validates/narrows it).
   */
  extract(req: ExtractRequest): Promise<unknown>;
  /**
   * One step of a streaming, multi-turn tool-use loop: stream assistant text via
   * `onToken`, and return any tool calls plus the opaque assistant turn to echo
   * back. The caller runs the tools and loops. Providers where
   * `supportsAgentTools` is false throw.
   */
  streamAgentStep(req: AgentStepRequest): Promise<AgentStepResult>;
}
