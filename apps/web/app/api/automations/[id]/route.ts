import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const patchSchema = z.object({ enabled: z.boolean() });

/** Toggle a rule on/off. */
export const PATCH = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  const result = await getDb()
    .update(schema.automationRules)
    .set({ enabled: parsed.data.enabled })
    .where(and(eq(schema.automationRules.id, id), eq(schema.automationRules.userId, u.id)))
    .returning({ id: schema.automationRules.id });
  if (result.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});

/** Delete a rule. */
export const DELETE = withUser(async (u, _request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const result = await getDb()
    .delete(schema.automationRules)
    .where(and(eq(schema.automationRules.id, id), eq(schema.automationRules.userId, u.id)))
    .returning({ id: schema.automationRules.id });
  if (result.length === 0) return jsonError("Not found", 404);
  return NextResponse.json({ ok: true });
});
