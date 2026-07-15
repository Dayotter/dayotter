import { deletePoll } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const ok = await deletePoll(id, u.id);
  if (!ok) return jsonError("Poll not found", 404);
  return NextResponse.json({ ok: true });
});
