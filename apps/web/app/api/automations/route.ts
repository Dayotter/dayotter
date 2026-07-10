import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { asc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

function serialize(r: typeof schema.automationRules.$inferSelect) {
  return {
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    trigger: r.trigger,
    matchTitle: r.matchTitle,
    action: r.action,
    offsetMinutes: r.offsetMinutes,
    blockTitle: r.blockTitle,
    dayOfWeek: r.dayOfWeek,
    windowStart: r.windowStart,
    windowEnd: r.windowEnd,
  };
}

/** The user's automation rules. */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.automationRules.findMany({
    where: eq(schema.automationRules.userId, u.id),
    orderBy: asc(schema.automationRules.createdAt),
  });
  return NextResponse.json({ rules: rows.map(serialize) });
});

const HM = z.string().regex(/^\d{1,2}:\d{2}$/, "Use HH:MM");

const body = z
  .object({
    name: z.string().min(1).max(120),
    trigger: z.enum(["booking_created", "weekly"]).default("booking_created"),
    matchTitle: z.string().max(120).nullable().default(null),
    action: z.enum(["prep_block", "buffer_after", "followup"]).default("prep_block"),
    offsetMinutes: z.number().int().min(5).max(10_080).default(15),
    blockTitle: z.string().max(120).nullable().default(null),
    dayOfWeek: z.number().int().min(0).max(6).nullable().default(null),
    windowStart: HM.nullable().default(null),
    windowEnd: HM.nullable().default(null),
  })
  .refine(
    (d) =>
      d.trigger !== "weekly" ||
      (d.dayOfWeek != null && d.windowStart != null && d.windowEnd != null),
    { message: "Weekly rules need a day and a time window", path: ["dayOfWeek"] },
  );

/** Create an automation rule. */
export const POST = withUser(async (u, request) => {
  const gate = await requireFeature(u.id, "automation");
  if (gate) return gate;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid rule", 400);
  }
  const d = parsed.data;
  const weekly = d.trigger === "weekly";

  const [created] = await getDb()
    .insert(schema.automationRules)
    .values({
      userId: u.id,
      name: d.name,
      trigger: d.trigger,
      // Weekly rules don't filter by booking title.
      matchTitle: weekly ? null : d.matchTitle?.trim() || null,
      action: d.action,
      offsetMinutes: d.offsetMinutes,
      blockTitle: d.blockTitle?.trim() || null,
      dayOfWeek: weekly ? d.dayOfWeek : null,
      windowStart: weekly ? d.windowStart : null,
      windowEnd: weekly ? d.windowEnd : null,
    })
    .returning();

  return NextResponse.json({ rule: serialize(created!) });
});
