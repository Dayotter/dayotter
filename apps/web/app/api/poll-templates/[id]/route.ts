import { deletePollMessageTemplate, updatePollMessageTemplate } from "@/lib/polls/poll-templates";
import { PollError } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// Every field is optional: a PATCH may change just the name, just the body, or
// just the default flag.
const bodySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  body: z.string().min(1).max(2000).optional(),
  isDefault: z.boolean().optional(),
});

export const PATCH = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid template", 400);
  try {
    await updatePollMessageTemplate(u.id, id, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.message, err.status);
    throw err;
  }
});

export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  try {
    await deletePollMessageTemplate(u.id, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.message, err.status);
    throw err;
  }
});
