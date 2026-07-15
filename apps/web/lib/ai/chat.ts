import type Anthropic from "@anthropic-ai/sdk";
import { logger } from "@dayotter/core";
import { getPluginTool, pluginTools, runPluginTool } from "@dayotter/plugin-host";
import { DateTime } from "luxon";
import { FREE_SLOTS_TOOL, findFreeSlots } from "./agent";
import {
  type BookingContext,
  type CommandDraft,
  commandDraftSchema,
  commandInputSchema,
} from "./command-parse";
import { GUARDRAIL_PREAMBLE } from "./guardrails";
import { MODELS, getAnthropicClient } from "./llm";
import { retrieveCalendarContext } from "./retrieval";
import { executeReadTool } from "./tools/exec";
import { anthropicToolDefs, getTool } from "./tools/registry";

/** One turn of the chat, as the client stores it (plain text, not Anthropic blocks). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** A resolved, confirm-first action the assistant proposes mid-conversation. */
export interface ChatAction {
  draft: CommandDraft;
  target: { uid: string; title: string; startISO: string } | null;
  matchedEventType: { title: string; slug: string; durationMinutes: number } | null;
}

/** A confirm-first registry action (booking types, availability, preferences, …). */
export interface ChatToolAction {
  tool: string;
  title: string;
  summary: string;
  confirmLevel: "confirm" | "danger";
  input: unknown;
}

/** SSE events the stream emits to the client. */
export type ChatEvent =
  | { type: "token"; text: string }
  | { type: "action"; action: ChatAction }
  | { type: "tool_action"; toolAction: ChatToolAction }
  | { type: "done"; text: string }
  | { type: "error"; message: string };

const CHAT_SYSTEM = `You are Otter, DayOtter's friendly scheduling assistant, chatting with the signed-in host inside their dashboard.

Your scope is the host's calendar: answering questions about their schedule, and helping them create meetings / focus blocks / reminders, or reschedule and cancel their EXISTING bookings. Politely decline anything outside scheduling (you don't write essays, give general advice, or browse the web).

HOW YOU WORK:
- You are CONVERSATIONAL. Reply in a warm, concise, natural voice - usually 1–3 sentences. No markdown headings or bullet dumps; this is a chat.
- You are given the current time, the host's timezone, their event types, and their upcoming bookings (each with a numeric ref). Use them to answer questions directly ("When's my next meeting?", "How busy is Thursday?").
- You NEVER change anything yourself. When the host wants to create, move, or cancel something, call the propose_action tool with a draft. The host sees an editable card and confirms - only then does it happen. After you call propose_action, add one short sentence telling them to review and confirm.
- When a time depends on when the host is actually free ("find me a free 30 min", "my next open afternoon"), call find_free_slots FIRST, then use a real returned slot in the draft. Never invent availability.
- Resolve every time to an absolute ISO-8601 instant in the host's timezone. Never pick a past time. Interpret vague times locally (morning=09:00, afternoon=14:00, evening=18:00).
- For reschedule/cancel, set bookingRef to the exact ref of the intended booking. If several could match and you can't tell, DON'T propose - just ask which one in your reply.
- If you're only answering a question (not proposing a change), reply in plain text and do not call propose_action.

BEYOND BOOKINGS - you can also read and control the rest of the host's setup with these tools:
- Reads (use freely to answer questions, and BEFORE changing something so you know the current values): list_booking_types, get_availability, get_preferences, list_focus_blocks, list_notification_channels, find_focus_time.
- Actions (each shows the host a confirm card - nothing happens until they tap Confirm): create_booking_type, create_focus_block, protect_focus_time, update_preferences, set_weekly_hours, delete_booking_type, delete_focus_block.

PROTECTING TIME (act like a great EA - do the work, don't just advise): when the host wants focus / deep-work / heads-down time, or time set aside for a task ("block 6 hours of focus this week", "I need 4 hours for the deck by Friday", "protect my mornings"), call find_focus_time FIRST (pass hoursNeeded, an optional byDate deadline, and chunkMinutes if they hint at block length). Briefly tell them the specific times you found, then propose protect_focus_time with those exact blocks. For a single quick hold you may still use create_focus_block. Never invent times - only protect blocks that find_focus_time returned.
Rules for these: propose exactly ONE action at a time. NEVER say you've done, created, changed, or deleted something - you have only proposed it; the host confirms. Deleting always requires the host's explicit confirmation. For set_weekly_hours and update_preferences, call the matching read tool first and carry over the values the host wants to keep (both replace/merge against current state). Use propose_action ONLY for bookings (create/reschedule/cancel a meeting); use these tools for booking types, availability, preferences, and focus blocks.`;

const PROPOSE_ACTION_TOOL: Anthropic.Tool = {
  name: "propose_action",
  description:
    "Propose a confirm-first scheduling action (create / reschedule / cancel) for the host to review and confirm. Only call this when the host wants to change their calendar - not to answer a question.",
  input_schema: commandInputSchema as unknown as Anthropic.Tool.InputSchema,
};

const MAX_STEPS = 4;

/** Build the fresh (uncached) per-turn context block: time, event types, bookings. */
async function buildContext(userId: string, latestUserText: string) {
  const ctx = await retrieveCalendarContext(userId, latestUserText);
  const tz = ctx.timezone;
  const contexts: BookingContext[] = ctx.bookings.map((b, i) => ({
    ref: i + 1,
    title: b.title,
    whenLocal: DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a"),
    attendees: b.attendees,
  }));
  const typeList = ctx.eventTypes.length
    ? ctx.eventTypes
        .map((e) => `- "${e.title}" (${e.durationMinutes} min) [slug: ${e.slug}]`)
        .join("\n")
    : "(none)";
  const bookingList = contexts.length
    ? contexts
        .map(
          (b) =>
            `#${b.ref}: "${b.title}" - ${b.whenLocal}${b.attendees.length ? ` (with ${b.attendees.join(", ")})` : ""}`,
        )
        .join("\n")
    : "(none)";
  const block = `Current time: ${new Date().toISOString()} (timezone: ${tz})

The host's event types:
${typeList}

The host's upcoming bookings:
${bookingList}`;
  return { ctx, tz, contexts, block };
}

/** Resolve a raw model draft into a confirm-first action (ref → real booking uid). */
function resolveAction(
  draft: CommandDraft,
  ctx: Awaited<ReturnType<typeof buildContext>>["ctx"],
): ChatAction {
  let matchedEventType: ChatAction["matchedEventType"] = null;
  if (draft.intent === "create" && draft.eventTypeSlug) {
    matchedEventType = ctx.eventTypes.find((e) => e.slug === draft.eventTypeSlug) ?? null;
  }
  let target: ChatAction["target"] = null;
  if (draft.intent === "reschedule" || draft.intent === "cancel") {
    const b = ctx.bookings[draft.bookingRef - 1];
    if (b) target = { uid: b.uid, title: b.title, startISO: b.startsAt.toISOString() };
  }
  return { draft, target, matchedEventType };
}

/**
 * Run one assistant turn over the conversation, streaming tokens and (optionally)
 * a proposed action via `emit`. Read-only: the only tool that touches data is
 * find_free_slots (a read); propose_action just returns a draft to confirm.
 */
export async function streamAssistant(params: {
  userId: string;
  turns: ChatTurn[];
  emit: (event: ChatEvent) => void;
}): Promise<void> {
  const { userId, turns, emit } = params;
  const latestUser = [...turns].reverse().find((t) => t.role === "user");
  const { ctx, tz, block } = await buildContext(userId, latestUser?.content ?? "");

  const client = getAnthropicClient();
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: GUARDRAIL_PREAMBLE, cache_control: { type: "ephemeral" } },
    { type: "text", text: CHAT_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: block },
  ];
  const messages: Anthropic.MessageParam[] = turns.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  let fullText = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const stream = client.messages.stream({
      model: MODELS.deep,
      max_tokens: 3000,
      system,
      tools: [
        FREE_SLOTS_TOOL,
        PROPOSE_ACTION_TOOL,
        ...(anthropicToolDefs() as Anthropic.Tool[]),
        ...pluginTools().map(
          (p): Anthropic.Tool => ({
            name: p.name,
            description: p.tool.description,
            input_schema: p.tool.schema as Anthropic.Tool.InputSchema,
          }),
        ),
      ],
      tool_choice: { type: "auto" },
      output_config: { effort: "medium" },
      thinking: { type: "adaptive" },
      messages,
    });

    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta" && ev.delta.text) {
        fullText += ev.delta.text;
        emit({ type: "token", text: ev.delta.text });
      }
    }

    const final = await stream.finalMessage();
    const toolUses = final.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    // 1. Booking create/reschedule/cancel → the rich editable card.
    const proposal = toolUses.find((b) => b.name === "propose_action");
    if (proposal) {
      try {
        const draft = commandDraftSchema.parse(proposal.input);
        if (draft.understood && draft.intent !== "none") {
          emit({ type: "action", action: resolveAction(draft, ctx) });
        }
      } catch (err) {
        logger.warn("chat action parse failed", { event: "ai_chat_action_parse_failed", err });
      }
      break;
    }

    // 2. Registry write/destructive tool → generic confirm card. NOT executed here;
    //    the client runs it via /api/ai/act only after the host confirms.
    const actionCall = toolUses.find((b) => {
      const t = getTool(b.name);
      if (t && t.kind !== "read") return true;
      return getPluginTool(b.name)?.tool.kind === "action";
    });
    if (actionCall) {
      const inp = (actionCall.input ?? {}) as Record<string, unknown>;
      const core = getTool(actionCall.name);
      if (core) {
        emit({
          type: "tool_action",
          toolAction: {
            tool: core.name,
            title: core.title,
            summary: core.summarize(inp),
            confirmLevel: core.confirmLevel === "danger" ? "danger" : "confirm",
            input: inp,
          },
        });
      } else {
        const p = getPluginTool(actionCall.name)!;
        emit({
          type: "tool_action",
          toolAction: {
            tool: p.name,
            title: p.tool.title ?? p.tool.name,
            summary: p.tool.summarize?.(inp) ?? p.tool.description,
            confirmLevel: p.tool.danger ? "danger" : "confirm",
            input: inp,
          },
        });
      }
      break;
    }

    // 3. Reads (registry reads + find_free_slots) → run inline, feed back, loop.
    const reads = toolUses.filter(
      (b) =>
        b.name === "find_free_slots" ||
        getTool(b.name)?.kind === "read" ||
        getPluginTool(b.name)?.tool.kind === "read",
    );
    if (reads.length === 0) break; // plain conversational answer-done

    messages.push({ role: "assistant", content: final.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of reads) {
      const input = (call.input ?? {}) as Record<string, unknown>;
      let content: string;
      if (call.name === "find_free_slots") {
        content = await findFreeSlots(
          userId,
          call.input as { durationMinutes: number; fromISO: string; toISO: string },
          tz,
        ).catch(() => "Could not look up availability.");
      } else if (getTool(call.name)?.kind === "read") {
        content = await executeReadTool(userId, call.name, input).catch(
          () => "Could not read that.",
        );
      } else {
        content = await runPluginTool(call.name, userId, input).catch(() => "Could not run that.");
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content });
    }
    messages.push({ role: "user", content: results });
  }

  emit({ type: "done", text: fullText.trim() });
}
