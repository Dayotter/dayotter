import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Delete one of the user's personal / focus blocks. */
export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const result = await getDb()
    .delete(schema.timeBlocks)
    .where(and(eq(schema.timeBlocks.id, id), eq(schema.timeBlocks.userId, u.id)))
    .returning({ id: schema.timeBlocks.id });
  if (result.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
