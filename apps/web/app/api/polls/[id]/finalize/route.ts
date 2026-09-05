import { PollError, finalizePoll } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  optionId: z.string().uuid(),
  /** Host-written meeting details (Zoom link, address, ...) sent with the
   * confirmation emails. */
  message: z.string().max(2000).optional(),
});

export const POST = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);
  try {
    await finalizePoll(id, u.id, parsed.data.optionId, parsed.data.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof PollError) return jsonError(err.message, err.status);
    throw err;
  }
});
