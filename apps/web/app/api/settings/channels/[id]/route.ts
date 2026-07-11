import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ remindersEnabled: z.boolean() });

/** Toggle whether reminders are delivered on this channel. */
export const PATCH = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  const result = await getDb()
    .update(schema.notificationChannels)
    .set({ remindersEnabled: parsed.data.remindersEnabled })
    .where(
      and(eq(schema.notificationChannels.id, id), eq(schema.notificationChannels.userId, u.id)),
    )
    .returning({ id: schema.notificationChannels.id });

  if (result.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});

/** Remove a channel. */
export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const result = await getDb()
    .delete(schema.notificationChannels)
    .where(
      and(eq(schema.notificationChannels.id, id), eq(schema.notificationChannels.userId, u.id)),
    )
    .returning({ id: schema.notificationChannels.id });

  if (result.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
