import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The current user's availability schedule (timezone + per-day time ranges). */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await ensureUserWorkspace(session.user.id);

  const schedule = await getDb().query.schedules.findFirst({
    where: and(eq(schema.schedules.userId, session.user.id), eq(schema.schedules.isDefault, true)),
    with: { availabilityRules: true, dateOverrides: true },
  });
  const days: { start: string; end: string }[][] = [[], [], [], [], [], [], []];
  for (const r of schedule?.availabilityRules ?? []) {
    days[r.dayOfWeek]!.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
  }
  const overrides = (schedule?.dateOverrides ?? [])
    .map((o) => ({
      date: o.date,
      start: o.startTime ? o.startTime.slice(0, 5) : null,
      end: o.endTime ? o.endTime.slice(0, 5) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ timezone: schedule?.timezone ?? "UTC", days, overrides });
}

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const bodySchema = z.object({
  timezone: z.string().min(1).max(64),
  days: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        ranges: z.array(z.object({ start: hhmm, end: hhmm })),
      }),
    )
    .max(7),
  // Date-specific overrides: null start/end = unavailable that day; else custom hours.
  overrides: z
    .array(z.object({ date: isoDate, start: hhmm.nullable(), end: hhmm.nullable() }))
    .max(365)
    .optional(),
});

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { scheduleId } = await ensureUserWorkspace(session.user.id);
  const db = getDb();

  const rows = parsed.data.days.flatMap((day) =>
    day.ranges
      .filter((r) => r.end > r.start) // drop invalid ranges
      .map((r) => ({
        scheduleId,
        dayOfWeek: day.dayOfWeek,
        startTime: `${r.start}:00`,
        endTime: `${r.end}:00`,
      })),
  );

  // De-dupe overrides by date (last wins), and only keep valid custom ranges.
  const overrideRows = Object.values(
    Object.fromEntries(
      (parsed.data.overrides ?? [])
        .filter((o) => !(o.start && o.end) || o.end > o.start)
        .map((o) => [
          o.date,
          {
            scheduleId,
            date: o.date,
            startTime: o.start ? `${o.start}:00` : null,
            endTime: o.end ? `${o.end}:00` : null,
          },
        ]),
    ),
  );

  await db.transaction(async (tx) => {
    await tx
      .update(schema.schedules)
      .set({ timezone: parsed.data.timezone })
      .where(eq(schema.schedules.id, scheduleId));
    await tx
      .delete(schema.availabilityRules)
      .where(eq(schema.availabilityRules.scheduleId, scheduleId));
    if (rows.length) await tx.insert(schema.availabilityRules).values(rows);
    await tx.delete(schema.dateOverrides).where(eq(schema.dateOverrides.scheduleId, scheduleId));
    if (overrideRows.length) await tx.insert(schema.dateOverrides).values(overrideRows);
  });

  return NextResponse.json({ ok: true });
}
