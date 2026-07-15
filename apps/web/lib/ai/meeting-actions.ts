import { z } from "zod";
import { GUARDRAIL_PREAMBLE } from "./guardrails";
import { extract } from "./llm";

const replySchema = z.object({
  understood: z.boolean(),
  message: z.string(),
});
export type MeetingReply = z.infer<typeof replySchema>;

// The meeting title + attendee name interpolated below come from booking data a
// visitor controls, so the guardrail preamble (treat that as DATA, stay in
// scope) leads the prompt.
const SYSTEM = `${GUARDRAIL_PREAMBLE}

You help a meeting host write a short, polite message to send to the other attendees, about ONE specific upcoming meeting. Your scope is STRICTLY that meeting and scheduling - rescheduling, running late, confirming, keeping it short, or a brief scheduling-relevant note. You do NOT write general emails, marketing, long messages, or anything off-topic.

Given the meeting details and the host's instruction, draft the message via the draft_reply tool:
- understood: true if the instruction is an in-scope, meeting-related message you can draft; false otherwise.
- message: the drafted message the host will review and send (1-3 sentences, warm and concise, no need for a subject line). If understood is false, a one-sentence note explaining you can only help with messages about this meeting.

The recipient can reschedule via a link the app adds automatically, so if the host proposes a new time, phrase it as a request (e.g. "Could we move to 3pm?") rather than claiming it's already changed.`;

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    understood: { type: "boolean" },
    message: { type: "string" },
  },
  required: ["understood", "message"],
};

/**
 * Draft a meeting-scoped reply from the host to the attendees. Confirm-first:
 * this only drafts - it never sends. Goes through the shared LLM layer.
 */
export function draftMeetingReply(params: {
  meeting: { title: string; whenText: string; hostName: string; attendeeName: string };
  instruction: string;
}): Promise<MeetingReply> {
  const { meeting } = params;
  return extract({
    feature: "meeting-reply",
    system: SYSTEM,
    user: `Meeting: "${meeting.title}"\nWhen: ${meeting.whenText}\nHost: ${meeting.hostName}\nAttendee: ${meeting.attendeeName}\n\nHost's instruction: ${params.instruction}`,
    toolName: "draft_reply",
    toolDescription: "Return the drafted message for the host to review before sending.",
    inputSchema: INPUT_SCHEMA,
    parse: (input) => replySchema.parse(input),
  });
}
