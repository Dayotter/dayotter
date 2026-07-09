import { z } from "zod";
import { extract } from "./llm";

export { aiEnabled } from "./llm";

/** A compact view of one of the host's upcoming bookings, given to the model so
 *  it can resolve "my 3pm" / "the call with Dana" to a specific meeting. */
export interface BookingContext {
  /** 1-based reference the model echoes back (safer than echoing a UUID). */
  ref: number;
  title: string;
  whenLocal: string;
  attendees: string[];
}

/**
 * The unified command draft. Confirm-first: the AI only proposes; the human
 * confirms before anything is created, moved, or cancelled.
 */
export const commandDraftSchema = z.object({
  /** Chain-of-thought: the model's step-by-step reasoning, written before the answer. */
  reasoning: z.string(),
  understood: z.boolean(),
  intent: z.enum(["create", "reschedule", "cancel", "none"]),
  // create fields
  kind: z.enum(["meeting", "focus", "reminder"]),
  title: z.string(),
  startISO: z.string(),
  durationMinutes: z.number().int().min(5).max(1440),
  attendees: z.array(z.object({ name: z.string(), email: z.string() })),
  notes: z.string(),
  // reschedule / cancel fields
  bookingRef: z.number().int().min(0),
  newStartISO: z.string(),
  message: z.string(),
});
export type CommandDraft = z.infer<typeof commandDraftSchema>;

const SYSTEM = `You are calSync's scheduling assistant. Your scope is STRICTLY calendar scheduling: creating meetings / focus blocks / reminders, and managing the user's EXISTING bookings by rescheduling or cancelling them. You do NOT write emails, answer general questions, give advice, or do anything outside calendar scheduling.

You NEVER take actions. You only produce a structured DRAFT that the human reviews and confirms.

Think step by step FIRST. In the "reasoning" field, work through: what is the user asking for; if it references an existing meeting, which numbered booking matches (and why that one, not another); what absolute time results from any relative expression. Only then fill the remaining fields. Keep reasoning to a few sentences.

You are given the user's upcoming bookings, each with a numeric ref. Decide the intent:
- "create": the user wants a NEW meeting / focus block / reminder.
- "reschedule": the user wants to MOVE an existing booking. Set bookingRef to the matching booking's ref and newStartISO to the target time.
- "cancel": the user wants to CANCEL an existing booking. Set bookingRef to the matching booking's ref.
- "none": out of scope, or you cannot confidently identify which booking they mean.

Rules:
- understood: true only if you can produce an actionable draft; false otherwise.
- Resolve all times to ABSOLUTE ISO-8601 instants using the provided current time and timezone. Interpret vague times in the user's local timezone ("morning"=09:00, "afternoon"=14:00, "evening"=18:00). Never pick a past time.
- For create: kind, a short title, startISO, durationMinutes (default 30 meeting / 60 focus), attendees (name + email if given, else empty email), notes.
- For reschedule/cancel: set bookingRef to the exact ref of the intended booking. If several bookings could match and you can't tell, use intent "none" and ask which one in message.
- bookingRef must be 0 for create/none.
- message: for "none", one short sentence — either that you only help with scheduling, or a clarifying question naming the ambiguous options. Otherwise empty.`;

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasoning: {
      type: "string",
      description:
        "Think step by step here FIRST: the request, which booking matches, the resolved absolute time.",
    },
    understood: { type: "boolean" },
    intent: { type: "string", enum: ["create", "reschedule", "cancel", "none"] },
    kind: { type: "string", enum: ["meeting", "focus", "reminder"] },
    title: { type: "string" },
    startISO: { type: "string", description: "ISO-8601 instant" },
    durationMinutes: { type: "integer" },
    attendees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" }, email: { type: "string" } },
        required: ["name", "email"],
      },
    },
    notes: { type: "string" },
    bookingRef: { type: "integer", description: "1-based ref of the target booking, or 0" },
    newStartISO: { type: "string", description: "ISO-8601 instant for a reschedule, else empty" },
    message: { type: "string" },
  },
  required: [
    "reasoning",
    "understood",
    "intent",
    "kind",
    "title",
    "startISO",
    "durationMinutes",
    "attendees",
    "notes",
    "bookingRef",
    "newStartISO",
    "message",
  ],
};

/**
 * Parse a natural-language command into an editable draft — create, reschedule,
 * or cancel. Confirm-first: only interprets, never writes. Goes through the
 * shared LLM layer.
 */
export function parseCommand(params: {
  text: string;
  timezone: string;
  now: Date;
  bookings: BookingContext[];
}): Promise<CommandDraft> {
  const list = params.bookings.length
    ? params.bookings
        .map(
          (b) =>
            `#${b.ref}: "${b.title}" — ${b.whenLocal}${b.attendees.length ? ` (with ${b.attendees.join(", ")})` : ""}`,
        )
        .join("\n")
    : "(none)";

  return extract({
    feature: "command-parse",
    system: SYSTEM,
    user: `Current time: ${params.now.toISOString()} (timezone: ${params.timezone})

Upcoming bookings:
${list}

Request: ${params.text}`,
    toolName: "propose_command",
    toolDescription: "Return the structured command draft for the user to review.",
    inputSchema: INPUT_SCHEMA,
    parse: (input) => commandDraftSchema.parse(input),
  });
}
