import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { asc, eq, getDb, schema, sql } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** All of the user's named availability schedules. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUserWorkspace(session.user.id);

  const rows = await getDb()
    .select({
      id: schema.schedules.id,
      name: schema.schedules.name,
      timezone: schema.schedules.timezone,
      isDefault: schema.schedules.isDefault,
      ruleCount: sql<number>`count(${schema.availabilityRules.id})::int`,
    })
    .from(schema.schedules)
    .leftJoin(
      schema.availabilityRules,
      eq(schema.availabilityRules.scheduleId, schema.schedules.id),
    )
    .where(eq(schema.schedules.userId, session.user.id))
    .groupBy(schema.schedules.id)
    .orderBy(sql`${schema.schedules.isDefault} desc`, asc(schema.schedules.createdAt));

  return NextResponse.json({ schedules: rows });
}

const body = z.object({ name: z.string().min(1).max(80) });

/** Create a new named schedule, seeded with weekday 9-5 in the user's timezone. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  await ensureUserWorkspace(session.user.id);
  const db = getDb();

  // Inherit the timezone from the user's default schedule.
  const def = await db.query.schedules.findFirst({
    where: eq(schema.schedules.userId, session.user.id),
    columns: { timezone: true },
    orderBy: (s, { desc }) => [desc(s.isDefault)],
  });

  const [created] = await db
    .insert(schema.schedules)
    .values({
      userId: session.user.id,
      name: parsed.data.name,
      timezone: def?.timezone ?? "UTC",
      isDefault: false,
    })
    .returning();

  // Seed Mon–Fri 09:00–17:00 so the schedule is usable immediately.
  await db.insert(schema.availabilityRules).values(
    [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      scheduleId: created!.id,
      dayOfWeek,
      startTime: "09:00:00",
      endTime: "17:00:00",
    })),
  );

  return NextResponse.json({ id: created!.id, name: created!.name });
}
