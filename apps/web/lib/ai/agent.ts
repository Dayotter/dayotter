import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "@dayotter/core";
import { DateTime } from "luxon";
import { hostSlots } from "../booking/availability";
import {
  type BookingContext,
  type CommandDraft,
  type EventTypeContext,
  buildCommandUser,
  commandDraftSchema,
  commandInputSchema,
  commandSystem,
} from "./command-parse";
import { MODELS, getAnthropicClient } from "./llm";

/**
 * Read-only agentic loop for scheduling requests that need real availability
 * before a time can be proposed (e.g. "find me a free 30 min with Dana next
 * week", "move my 1:1 to my next open afternoon slot"). The model may call
 * `find_free_slots` to look up when the host is actually free, reason across the
 * results, then emit the SAME confirm-first `propose_command` draft the
 * single-shot parser produces. It NEVER writes — the only tool is a read.
 */

export const FREE_SLOTS_TOOL: Anthropic.Tool = {
  name: "find_free_slots",
  description:
    "Look up times the host is genuinely free for a meeting of a given length, within a date range. Call this to ground a proposed time in real availability before proposing it. Returns up to 8 open slots.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      durationMinutes: { type: "integer", description: "Meeting length in minutes." },
      fromISO: { type: "string", description: "Search window start (ISO-8601 instant)." },
      toISO: { type: "string", description: "Search window end (ISO-8601 instant)." },
    },
    required: ["durationMinutes", "fromISO", "toISO"],
  } as unknown as Anthropic.Tool.InputSchema,
};

const OUTPUT_TOOL: Anthropic.Tool = {
  name: "propose_command",
  description: "Return the final structured command draft for the user to review and confirm.",
  input_schema: commandInputSchema as unknown as Anthropic.Tool.InputSchema,
};

/** Execute the read-only tool: the host's real free slots in a bounded window. */
export async function findFreeSlots(
  userId: string,
  input: { durationMinutes: number; fromISO: string; toISO: string },
  timezone: string,
): Promise<string> {
  const duration = Math.min(Math.max(Math.round(input.durationMinutes || 30), 5), 480);
  const from = new Date(input.fromISO);
  const rawTo = new Date(input.toISO);
  if (Number.isNaN(from.getTime()) || Number.isNaN(rawTo.getTime())) {
    return "Invalid date range.";
  }
  // Clamp the window to 21 days so a broad request can't force a huge scan.
  const to = new Date(Math.min(rawTo.getTime(), from.getTime() + 21 * 86_400_000));

  const slots = await hostSlots(
    userId,
    null,
    {
      durationMinutes: duration,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minimumNoticeMinutes: 0,
      slotIntervalMinutes: 30,
      bookingWindowDays: 60,
    },
    from,
    to,
  );
  if (slots.length === 0) return "No free slots in that range.";
  return slots
    .slice(0, 8)
    .map(
      (s) =>
        `${s.start.toISOString()} (${DateTime.fromJSDate(s.start).setZone(timezone).toFormat("ccc, LLL d 'at' h:mm a")})`,
    )
    .join("\n");
}

const MAX_STEPS = 4;

/**
 * Run the scheduling agent. Returns the confirm-first draft. Falls back to
 * `understood: false` if the model never proposes a command within the step cap.
 */
export async function runSchedulingAgent(params: {
  userId: string;
  text: string;
  timezone: string;
  now: Date;
  bookings: BookingContext[];
  eventTypes?: EventTypeContext[];
}): Promise<CommandDraft> {
  const client = getAnthropicClient();
  const system = `${commandSystem}

You also have a read-only tool, find_free_slots, that returns times the host is actually free. When the request depends on when the host is available (e.g. "find a free slot", "my next open afternoon", "sometime next week"), call find_free_slots FIRST, then choose a real returned slot for startISO/newStartISO. Never invent availability. When you have everything you need, call propose_command with the final draft.`;

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: buildCommandUser(params) }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await client.messages.create({
      model: MODELS.deep,
      max_tokens: 3000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [FREE_SLOTS_TOOL, OUTPUT_TOOL],
      tool_choice: { type: "auto" },
      // Adaptive thinking (compatible with auto tool-choice) so the model reasons
      // across the availability it looks up before proposing a time. Assistant
      // content — including thinking blocks — is echoed back below, as required.
      output_config: { effort: "high" },
      thinking: { type: "adaptive" },
      messages,
    });

    const output = response.content.find(
      (b) => b.type === "tool_use" && b.name === "propose_command",
    );
    if (output && output.type === "tool_use") {
      return commandDraftSchema.parse(output.input);
    }

    const reads = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "find_free_slots",
    );
    if (reads.length === 0) break; // no tool call and no proposal → give up to the fallback

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of reads) {
      const text = await findFreeSlots(
        params.userId,
        call.input as { durationMinutes: number; fromISO: string; toISO: string },
        params.timezone,
      ).catch(() => "Could not look up availability.");
      results.push({ type: "tool_result", tool_use_id: call.id, content: text });
    }
    messages.push({ role: "user", content: results });
  }

  logger.warn("scheduling agent did not converge", {
    event: "ai_agent_no_proposal",
    userId: params.userId,
  });
  return commandDraftSchema.parse({
    reasoning: "The agent could not resolve the request within its step budget.",
    understood: false,
    intent: "none",
    kind: "meeting",
    title: "",
    startISO: "",
    durationMinutes: 30,
    attendees: [],
    notes: "",
    eventTypeSlug: "",
    bookingRef: 0,
    newStartISO: "",
    message: "I couldn't work that out. Try naming a specific time, or manage it manually.",
  });
}
