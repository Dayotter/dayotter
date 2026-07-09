import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const patch = z.object({ disabled: z.boolean() });

/** Enable/disable a webhook endpoint. */
export const PATCH = withUser(async (u, request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const parsed = patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid", 400);
  const updated = await getDb()
    .update(schema.webhookEndpoints)
    .set({ disabledAt: parsed.data.disabled ? new Date() : null })
    .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, u.id)))
    .returning({ id: schema.webhookEndpoints.id });
  if (updated.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});

/** Delete a webhook endpoint. */
export const DELETE = withUser(async (u, _request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const deleted = await getDb()
    .delete(schema.webhookEndpoints)
    .where(and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, u.id)))
    .returning({ id: schema.webhookEndpoints.id });
  if (deleted.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
