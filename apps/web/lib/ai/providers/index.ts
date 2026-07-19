import { anthropicClient, anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import type { LlmProvider } from "./types";

/**
 * Selects the active LLM provider from `AI_PROVIDER` (default `anthropic`).
 * Set `AI_PROVIDER=openai` (with `OPENAI_API_KEY`, optionally `OPENAI_BASE_URL`
 * + `OPENAI_MODEL_DEEP/FAST`) to run Otter on OpenAI or any OpenAI-compatible
 * endpoint. Every `extract`-based feature works on either; the streaming command
 * bar is Anthropic-only for now (see `supportsAgentTools`).
 */
const SELECTED = (process.env.AI_PROVIDER || "anthropic").toLowerCase();

export const provider: LlmProvider = SELECTED === "openai" ? openaiProvider : anthropicProvider;

/** AI is optional platform-wide - on only when the active provider is configured. */
export const aiEnabled = provider.configured;

/** Whether the active, configured provider backs the streaming agentic command bar. */
export const supportsAgentTools = provider.configured && provider.supportsAgentTools;

export { anthropicClient };
export type { Effort, ExtractRequest, LlmProvider, ModelTier } from "./types";
