import { z } from "zod";
import { extract } from "./llm";

export { aiEnabled } from "./llm";

/** The structured, editable draft the AI proposes. It NEVER writes anything. */
export const scheduleDraftSchema = z.object({
  understood: z.boolean(),
  kind: z.enum(["meeting", "focus", "reminder"]),
  title: z.string(),
  startISO: z.string(),
  durationMinutes: z.number().int().min(5).max(1440),
  attendees: z.array(z.object({ name: z.string(), email: z.string() })),
  notes: z.string(),
  message: z.string(),
});
export type ScheduleDraft = z.infer<typeof scheduleDraftSchema>;

const SYSTEM = `You are calSync's scheduling assistant. Your scope is STRICTLY calendar scheduling — creating meetings, focus/deep-work blocks, and reminders. You do NOT write emails, answer general questions, give advice, or do anything outside calendar scheduling.

You NEVER take actions or book anything. You only produce a structured DRAFT that the human reviews, edits, and confirms.

From the user's natural-language request, produce a draft via the propose_draft tool:
- understood: true only if this is a scheduling request you can draft; false for anything out of scope.
- kind: "meeting" (involves other people), "focus" (a personal block / deep work / do-not-schedule / heads-down), or "reminder".
- title: a short, human event title.
- startISO: the ABSOLUTE start time as an ISO-8601 instant, resolved against the provided current time and timezone. Interpret vague times in the user's local timezone — "morning" = 09:00, "afternoon" = 14:00, "evening" = 18:00, "tonight" = 19:00. Never pick a time in the past.
- durationMinutes: from the request; default 30 for meetings, 60 for focus blocks.
- attendees: people named, with name and email if given (empty email if unknown). Empty array if none.
- notes: any extra detail worth keeping; otherwise empty.
- message: if understood is false, one sentence explaining you only help with scheduling; if the request is ambiguous, a short clarifying note; otherwise empty.`;

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    understood: { type: "boolean" },
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
    message: { type: "string" },
  },
  required: [
    "understood",
    "kind",
    "title",
    "startISO",
    "durationMinutes",
    "attendees",
    "notes",
    "message",
  ],
};

/**
 * Parse a natural-language scheduling request into an editable draft. Confirm-
 * first: this only interprets — it never writes to a calendar. Goes through the
 * shared LLM layer.
 */
export function parseScheduleRequest(params: {
  text: string;
  timezone: string;
  now: Date;
}): Promise<ScheduleDraft> {
  return extract({
    feature: "schedule-parse",
    system: SYSTEM,
    user: `Current time: ${params.now.toISOString()} (timezone: ${params.timezone})\n\nRequest: ${params.text}`,
    toolName: "propose_draft",
    toolDescription: "Return the structured scheduling draft for the user to review.",
    inputSchema: INPUT_SCHEMA,
    parse: (input) => scheduleDraftSchema.parse(input),
  });
}
