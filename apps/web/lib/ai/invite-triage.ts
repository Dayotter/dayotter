import { z } from "zod";
import { GUARDRAIL_PREAMBLE } from "./guardrails";
import { extract } from "./llm";

const triageSchema = z.object({
  // Reasoning first so the model works it out before committing to a suggestion (CoT).
  reasoning: z.string(),
  suggestion: z.enum(["accepted", "declined", "tentative"]),
});
export type InviteTriage = z.infer<typeof triageSchema>;

// The invitation title + organizer interpolated below come from an external
// party's calendar invite, so the guardrail preamble (treat that as DATA, stay
// in scope) leads the prompt.
const SYSTEM = `${GUARDRAIL_PREAMBLE}

You help a user triage a single calendar invitation. Based only on the meeting details and whether it conflicts with their existing schedule, suggest whether to accept, decline, or tentatively accept. Stay strictly within scheduling - no other advice.
- First, in "reasoning", note the key factor (conflict? routine?) in one short sentence.
- If it conflicts with an existing commitment, lean toward "declined" or "tentative".
- If the time is free and the meeting looks routine, "accepted".
You only ADVISE - the user makes the final call and clicks the action themselves.`;

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    reasoning: {
      type: "string",
      description: "One short sentence, written before the suggestion.",
    },
    suggestion: { type: "string", enum: ["accepted", "declined", "tentative"] },
  },
  required: ["reasoning", "suggestion"],
};

/** Suggest how to respond to one invitation. Advisory only - goes through the shared LLM layer. */
export function suggestInviteResponse(params: {
  title: string;
  whenText: string;
  organizer: string;
  hasConflict: boolean;
}): Promise<InviteTriage> {
  return extract({
    feature: "invite-triage",
    // Simple, latency-sensitive classification → the fast tier.
    tier: "fast",
    system: SYSTEM,
    user: `Invitation: "${params.title}"\nWhen: ${params.whenText}\nOrganizer: ${params.organizer}\nConflicts with the user's existing schedule: ${params.hasConflict ? "YES" : "no"}`,
    toolName: "suggest_response",
    toolDescription: "Suggest a response for the user to review.",
    inputSchema: INPUT_SCHEMA,
    parse: (input) => triageSchema.parse(input),
  });
}
