import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function ownedSchedule(userId: string, id: string) {
  return getDb().query.schedules.findFirst({
    where: and(eq(schema.schedules.id, id), eq(schema.schedules.userId, userId)),
  });
}

/** One schedule's timezone + per-day ranges + date overrides (for the editor). */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const schedule = await getDb().query.schedules.findFirst({
    where: and(eq(schema.schedules.id, id), eq(schema.schedules.userId, session.user.id)),
    with: { availabilityRules: true, dateOverrides: true },
  });
  if (!schedule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const days: { start: string; end: string }[][] = [[], [], [], [], [], [], []];
  for (const r of schedule.availabilityRules) {
    days[r.dayOfWeek]!.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
  }
  const overrides = schedule.dateOverrides
    .map((o) => ({
      date: o.date,
      start: o.startTime ? o.startTime.slice(0, 5) : null,
      end: o.endTime ? o.endTime.slice(0, 5) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    id: schedule.id,
    name: schedule.name,
    isDefault: schedule.isDefault,
    timezone: schedule.timezone,
    days,
    overrides,
  });
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const putBody = z.object({
  timezone: z.string().min(1).max(64),
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        ranges: z.array(z.object({ start: hhmm, end: hhmm })),
      }),
    )
    .max(7),
  overrides: z
    .array(z.object({ date: isoDate, start: hhmm.nullable(), end: hhmm.nullable() }))
    .max(365)
    .optional(),
});

/** Replace a schedule's rules + overrides (+ timezone). */
export async function PUT(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const owned = await ownedSchedule(session.user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = putBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rows = parsed.data.days.flatMap((day) =>
    day.ranges
      .filter((r) => r.end > r.start)
      .map((r) => ({
        scheduleId: id,
        dayOfWeek: day.dayOfWeek,
        startTime: `${r.start}:00`,
        endTime: `${r.end}:00`,
      })),
  );
  const overrideRows = Object.values(
    Object.fromEntries(
      (parsed.data.overrides ?? [])
        .filter((o) => !(o.start && o.end) || o.end > o.start)
        .map((o) => [
          o.date,
          {
            scheduleId: id,
            date: o.date,
            startTime: o.start ? `${o.start}:00` : null,
            endTime: o.end ? `${o.end}:00` : null,
          },
        ]),
    ),
  );

  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(schema.schedules)
      .set({ timezone: parsed.data.timezone })
      .where(eq(schema.schedules.id, id));
    await tx.delete(schema.availabilityRules).where(eq(schema.availabilityRules.scheduleId, id));
    if (rows.length) await tx.insert(schema.availabilityRules).values(rows);
    await tx.delete(schema.dateOverrides).where(eq(schema.dateOverrides.scheduleId, id));
    if (overrideRows.length) await tx.insert(schema.dateOverrides).values(overrideRows);
  });

  return NextResponse.json({ ok: true });
}

const patchBody = z.object({
  name: z.string().min(1).max(80).optional(),
  isDefault: z.literal(true).optional(),
});

/** Rename a schedule and/or make it the default. */
export async function PATCH(request: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const owned = await ownedSchedule(session.user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = patchBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const db = getDb();
  await db.transaction(async (tx) => {
    if (parsed.data.name) {
      await tx
        .update(schema.schedules)
        .set({ name: parsed.data.name })
        .where(eq(schema.schedules.id, id));
    }
    if (parsed.data.isDefault) {
      // Exactly one default per user.
      await tx
        .update(schema.schedules)
        .set({ isDefault: false })
        .where(eq(schema.schedules.userId, session.user.id));
      await tx.update(schema.schedules).set({ isDefault: true }).where(eq(schema.schedules.id, id));
    }
  });

  return NextResponse.json({ ok: true });
}

/** Delete a schedule (not the default). Event types on it fall back to default (FK set null). */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const owned = await ownedSchedule(session.user.id, id);
  if (!owned) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (owned.isDefault) {
    return NextResponse.json({ error: "You can't delete your default schedule." }, { status: 409 });
  }

  await getDb().delete(schema.schedules).where(eq(schema.schedules.id, id));
  return NextResponse.json({ ok: true });
}
