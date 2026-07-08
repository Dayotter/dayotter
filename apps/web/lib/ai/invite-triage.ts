import { z } from "zod";
import { extract } from "./llm";

const triageSchema = z.object({
  suggestion: z.enum(["accepted", "declined", "tentative"]),
  reasoning: z.string(),
});
export type InviteTriage = z.infer<typeof triageSchema>;

const SYSTEM = `You help a user triage a single calendar invitation. Based only on the meeting details and whether it conflicts with their existing schedule, suggest whether to accept, decline, or tentatively accept. Stay strictly within scheduling — no other advice.
- If it conflicts with an existing commitment, lean toward "declined" or "tentative".
- If the time is free and the meeting looks routine, "accepted".
You only ADVISE — the user makes the final call and clicks the action themselves. Keep the reasoning to one short sentence.`;

const INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestion: { type: "string", enum: ["accepted", "declined", "tentative"] },
    reasoning: { type: "string" },
  },
  required: ["suggestion", "reasoning"],
};

/** Suggest how to respond to one invitation. Advisory only — goes through the shared LLM layer. */
export function suggestInviteResponse(params: {
  title: string;
  whenText: string;
  organizer: string;
  hasConflict: boolean;
}): Promise<InviteTriage> {
  return extract({
    feature: "invite-triage",
    system: SYSTEM,
    user: `Invitation: "${params.title}"\nWhen: ${params.whenText}\nOrganizer: ${params.organizer}\nConflicts with the user's existing schedule: ${params.hasConflict ? "YES" : "no"}`,
    toolName: "suggest_response",
    toolDescription: "Suggest a response for the user to review.",
    inputSchema: INPUT_SCHEMA,
    parse: (input) => triageSchema.parse(input),
  });
}
