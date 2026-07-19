import { deletePoll, getPollForHost } from "@/lib/polls/polls";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** A poll's full results for its host (mobile Poll detail: options + votes). */
export const GET = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const poll = await getPollForHost(id, u.id);
  if (!poll) return jsonError("Poll not found", 404);
  return NextResponse.json({ poll });
});

export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const ok = await deletePoll(id, u.id);
  if (!ok) return jsonError("Poll not found", 404);
  return NextResponse.json({ ok: true });
});
