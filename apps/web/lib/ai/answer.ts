import { DateTime } from "luxon";
import { z } from "zod";
import { FREE_SLOTS_TOOL, findFreeSlots } from "./agent";
import { capabilitySummary } from "./catalogue";
import { GUARDRAIL_PREAMBLE } from "./guardrails";
import {
  type AgentToolResult,
  type AgentToolSpec,
  type AgentTurn,
  type SystemBlock,
  agentStep,
  extract,
} from "./llm";
import { retrieveCalendarContext } from "./retrieval";
import { executeReadTool } from "./tools/exec";
import { TOOLS, getTool } from "./tools/registry";

/**
 * Read-only Q&A for the non-chat surfaces (command bar, mobile Ask bar, inbound
 * SMS/WhatsApp). Those go through `interpret.ts`, which only ever produced a
 * create/reschedule/cancel DRAFT - so any question ("how busy am I?", "when's my
 * next meeting?") was answered with "I only help with scheduling". This adds a
 * text answer path: a compact, read-only agentic loop that grounds its reply in
 * the same tools the chat assistant uses, then returns plain text.
 *
 * Read-only by construction: only read tools + find_free_slots are offered, so a
 * one-shot ask can never mutate anything (no confirm step exists on these
 * surfaces).
 */

/** How the interpret layer should handle a request. */
export type RequestClass = "action" | "question" | "other";

const classifySchema = z.object({ label: z.enum(["action", "question", "other"]) });

const CLASSIFY_SYSTEM = `${GUARDRAIL_PREAMBLE}

Classify the user's message into exactly one label:
- "action": they want to CREATE, MOVE / RESCHEDULE, or CANCEL something on their calendar (book a meeting, hold focus time, move their 3pm, cancel a booking, set out of office, change a setting).
- "question": they are ASKING about their schedule, availability, bookings, analytics, or how DayOtter works, with NO change requested (e.g. "how busy am I this week?", "when's my next meeting?", "am I free Friday at 2pm?", "how do I reduce no-shows?").
- "other": not about the user's calendar or scheduling at all.
Return only the label.`;

/**
 * Decide whether a request is an action to draft, a question to answer, or out
 * of scope. One cheap classification call; keeps the answer path off the shared
 * command-draft schema (so the chat/action path is untouched).
 */
export async function classifyRequest(text: string): Promise<RequestClass> {
  try {
    const { label } = await extract({
      feature: "otter-classify",
      system: CLASSIFY_SYSTEM,
      user: text,
      tier: "fast",
      maxTokens: 8,
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { label: { type: "string", enum: ["action", "question", "other"] } },
        required: ["label"],
      },
      parse: (i) => classifySchema.parse(i),
    });
    return label;
  } catch {
    // If the classifier fails, fall back to treating it as an action (the
    // existing, safe, confirm-first path) rather than guessing an answer.
    return "action";
  }
}

const ANSWER_SYSTEM = `You are Otter, DayOtter's friendly scheduling assistant, answering the host's question about their own calendar. Reply in a warm, natural voice - usually one or two sentences, no markdown.

You are READ-ONLY here: look things up with the tools, but you never change anything (this surface has no confirm step). NEVER guess times, counts, or availability - call a tool to get real data:
- get_agenda / search_bookings for what's on the calendar; analyze_schedule for counts, hours, "when do I finish", conflicts, longest gap.
- check_availability for "am I free at X"; find_free_slots for bookable openings.
- list_booking_types, get_availability, get_preferences, list_out_of_office, get_analytics for setup/analytics questions; search_knowledge for how-to questions.
If the request isn't about the host's calendar or scheduling, briefly say you only help with their schedule. If they want to CHANGE something, tell them to ask directly (e.g. "book…", "move…", "cancel…") - you can't make changes from here.`;

/** Read tools only (never write/destructive), so this loop can't mutate anything. */
function readToolSpecs(): AgentToolSpec[] {
  return TOOLS.filter((t) => t.kind === "read").map((t) => ({
    name: t.name,
    description: t.description,
    schema: t.schema,
  }));
}

const MAX_STEPS = 4;

/**
 * Answer a calendar question as plain text, grounded in real reads. Returns a
 * short natural-language reply (never mutates). Used by the non-chat surfaces.
 */
export async function answerCalendarQuestion(userId: string, text: string): Promise<string> {
  const ctx = await retrieveCalendarContext(userId, text);
  const tz = ctx.timezone;
  const bookingList = ctx.bookings.length
    ? ctx.bookings
        .map((b) => {
          const when = DateTime.fromJSDate(b.startsAt)
            .setZone(tz)
            .toFormat("ccc, LLL d 'at' h:mm a");
          return `- "${b.title}" - ${when}${b.attendees.length ? ` (with ${b.attendees.join(", ")})` : ""}`;
        })
        .join("\n")
    : "(none)";
  const externalList = ctx.externalEvents.length
    ? ctx.externalEvents
        .map((e) => {
          const s = DateTime.fromJSDate(e.startsAt).setZone(tz);
          const en = DateTime.fromJSDate(e.endsAt).setZone(tz);
          return `- "${e.title}" - ${s.toFormat("ccc, LLL d 'at' h:mm a")}–${en.toFormat("h:mm a")}`;
        })
        .join("\n")
    : "(none)";
  const block = `Current time: ${new Date().toISOString()} (timezone: ${tz})

The host's upcoming DayOtter bookings:
${bookingList}

The host's synced calendar events (busy time from connected calendars, read-only):
${externalList}`;

  const system: SystemBlock[] = [
    { text: GUARDRAIL_PREAMBLE, cache: true },
    { text: ANSWER_SYSTEM, cache: true },
    { text: capabilitySummary(), cache: true },
    { text: block },
  ];
  const tools: AgentToolSpec[] = [FREE_SLOTS_TOOL, ...readToolSpecs()];
  const history: AgentTurn[] = [{ role: "user", text }];

  let fullText = "";
  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await agentStep({
      system,
      history,
      tools,
      tier: "deep",
      effort: "low",
      maxTokens: 800,
      onToken: (t) => {
        fullText += t;
      },
    });
    const reads = res.toolCalls.filter(
      (c) => c.name === "find_free_slots" || getTool(c.name)?.kind === "read",
    );
    if (reads.length === 0) break;
    history.push({ role: "assistant_raw", raw: res.assistant });
    const results: AgentToolResult[] = [];
    for (const call of reads) {
      const content =
        call.name === "find_free_slots"
          ? await findFreeSlots(
              userId,
              call.input as { durationMinutes: number; fromISO: string; toISO: string },
              tz,
            ).catch(() => "Could not look up availability.")
          : await executeReadTool(userId, call.name, call.input).catch(
              () => "Could not read that.",
            );
      results.push({ id: call.id, content });
    }
    history.push({ role: "tool_results", results });
  }

  return fullText.trim() || "I couldn't work that out - try asking a bit differently.";
}
