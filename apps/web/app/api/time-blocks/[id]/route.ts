import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Delete one of the user's personal / focus blocks. `?series=1` deletes the whole
 * recurring series this block belongs to (all future occurrences).
 */
export const DELETE = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const db = getDb();
  const wantSeries = new URL(request.url).searchParams.get("series") === "1";

  const block = await db.query.timeBlocks.findFirst({
    where: and(eq(schema.timeBlocks.id, id), eq(schema.timeBlocks.userId, u.id)),
    columns: { id: true, seriesId: true },
  });
  if (!block) return jsonError("Not found", 404);

  if (wantSeries && block.seriesId) {
    await db
      .delete(schema.timeBlocks)
      .where(
        and(eq(schema.timeBlocks.userId, u.id), eq(schema.timeBlocks.seriesId, block.seriesId)),
      );
  } else {
    await db.delete(schema.timeBlocks).where(eq(schema.timeBlocks.id, id));
  }
  return NextResponse.json({ ok: true });
});
