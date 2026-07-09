import { jsonError, withUser } from "@/lib/server/http";
import { asc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The user's automation rules. */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.automationRules.findMany({
    where: eq(schema.automationRules.userId, u.id),
    orderBy: asc(schema.automationRules.createdAt),
  });
  return NextResponse.json({
    rules: rows.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      matchTitle: r.matchTitle,
      action: r.action,
      offsetMinutes: r.offsetMinutes,
      blockTitle: r.blockTitle,
    })),
  });
});

const body = z.object({
  name: z.string().min(1).max(120),
  matchTitle: z.string().max(120).nullable().default(null),
  action: z.enum(["prep_block", "buffer_after"]).default("prep_block"),
  offsetMinutes: z.number().int().min(5).max(240).default(15),
  blockTitle: z.string().max(120).nullable().default(null),
});

/** Create an automation rule. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid rule", 400);
  const d = parsed.data;

  const [created] = await getDb()
    .insert(schema.automationRules)
    .values({
      userId: u.id,
      name: d.name,
      matchTitle: d.matchTitle?.trim() || null,
      action: d.action,
      offsetMinutes: d.offsetMinutes,
      blockTitle: d.blockTitle?.trim() || null,
    })
    .returning();

  return NextResponse.json({
    rule: {
      id: created!.id,
      name: created!.name,
      enabled: created!.enabled,
      matchTitle: created!.matchTitle,
      action: created!.action,
      offsetMinutes: created!.offsetMinutes,
      blockTitle: created!.blockTitle,
    },
  });
});
