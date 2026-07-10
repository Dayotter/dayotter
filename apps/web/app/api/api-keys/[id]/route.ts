import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Revoke (delete) an API key the caller owns. */
export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const deleted = await getDb()
    .delete(schema.apiKeys)
    .where(and(eq(schema.apiKeys.id, id), eq(schema.apiKeys.userId, u.id)))
    .returning({ id: schema.apiKeys.id });
  if (deleted.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
