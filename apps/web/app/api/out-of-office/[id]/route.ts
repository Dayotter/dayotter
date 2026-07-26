import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Delete one of the user's out-of-office periods. */
export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const deleted = await getDb()
    .delete(schema.outOfOfficePeriods)
    .where(and(eq(schema.outOfOfficePeriods.id, id), eq(schema.outOfOfficePeriods.userId, u.id)))
    .returning({ id: schema.outOfOfficePeriods.id });
  if (deleted.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
