import { createPollMessageTemplate, listPollMessageTemplates } from "@/lib/polls/poll-templates";
import { PollError } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The host's saved meeting-details templates (mobile Polls settings). */
export const GET = withUser(async (u) => {
  return NextResponse.json({ templates: await listPollMessageTemplates(u.id) });
});

const bodySchema = z.object({
  name: z.string().min(1).max(60),
  body: z.string().min(1).max(2000),
  isDefault: z.boolean().optional(),
});

export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid template", 400);
  try {
    const template = await createPollMessageTemplate(u.id, parsed.data);
    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.message, err.status);
    throw err;
  }
});
