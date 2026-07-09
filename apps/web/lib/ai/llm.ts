import Anthropic from "@anthropic-ai/sdk";
import { logger } from "@calsync/core";
import { managedAnthropicKey } from "../ee/managed-ai";

/**
 * The single LLM layer for the whole platform. Every AI feature goes through
 * here — no feature instantiates its own client, picks its own model, or hand-
 * rolls its own request. This centralizes: the model choice, the API key gate,
 * structured-extraction mechanics (forced tool-use → validated object), error
 * handling, and logging. Add a capability here; consume it from feature modules.
 */

/**
 * The key the platform uses. Self-host: the operator's own `ANTHROPIC_API_KEY`.
 * Cloud: falls back to calSync's managed key (the cloud-only "Managed AI"
 * feature) so Pro customers don't bring their own.
 */
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || managedAnthropicKey;

/** AI is optional platform-wide — nothing calls out unless a key is available. */
export const aiEnabled = Boolean(ANTHROPIC_KEY);

/** The one model the platform uses for AI. Change it in exactly one place. */
const MODEL = "claude-opus-4-8";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: ANTHROPIC_KEY });
  return client;
}

export interface ExtractOptions<T> {
  /** System prompt — set the assistant's scope and rules here. */
  system: string;
  /** The user's request / the content to interpret. */
  user: string;
  /** Name of the output tool (Claude is forced to call it). */
  toolName: string;
  toolDescription: string;
  /** JSON Schema for the tool input. */
  inputSchema: Record<string, unknown>;
  /** Validate/narrow the raw tool input into `T` (e.g. a Zod `.parse`). */
  parse: (input: unknown) => T;
  maxTokens?: number;
  /** Short label for logs. */
  feature: string;
}

/**
 * The platform's single structured-extraction primitive: prompt Claude, force it
 * to return data matching a schema, and hand back a validated object. Used by
 * every AI feature that needs structured output.
 */
export async function extract<T>(opts: ExtractOptions<T>): Promise<T> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1024,
    system: opts.system,
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
    logger.error("llm returned no structured result", { event: "llm_no_result", feature: opts.feature });
    throw new Error("The assistant did not return a result");
  }
  return opts.parse(toolUse.input);
}
