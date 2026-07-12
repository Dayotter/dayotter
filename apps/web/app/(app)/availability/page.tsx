import { FocusDefense } from "@/components/focus-defense";
import { PageHeader } from "@/components/page-header";
import { SchedulesManager } from "@/components/schedules-manager";
import { TimeBlocks } from "@/components/time-blocks";
import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { asc, eq, getDb, schema, sql } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const session = await getSession();
  const userId = session!.user.id;

  // Guarantee a default schedule exists so the editor always has somewhere to save.
  await ensureUserWorkspace(userId);
  const db = getDb();

  const summaries = await db
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
    .where(eq(schema.schedules.userId, userId))
    .groupBy(schema.schedules.id)
    .orderBy(sql`${schema.schedules.isDefault} desc`, asc(schema.schedules.createdAt));

  // Preload the default schedule's detail so the editor renders without a fetch flash.
  const selected = summaries.find((s) => s.isDefault) ?? summaries[0]!;
  const detail = await db.query.schedules.findFirst({
    where: eq(schema.schedules.id, selected.id),
    with: { availabilityRules: true, dateOverrides: true },
  });

  const days: { start: string; end: string }[][] = [[], [], [], [], [], [], []];
  for (const r of detail?.availabilityRules ?? []) {
    days[r.dayOfWeek]!.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
  }
  for (const list of days) list.sort((a, b) => a.start.localeCompare(b.start));

  const overrides = (detail?.dateOverrides ?? [])
    .map((o) => ({
      date: o.date,
      start: o.startTime ? o.startTime.slice(0, 5) : null,
      end: o.endTime ? o.endTime.slice(0, 5) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader
        eyebrow="Your hours"
        title="Availability"
        description="Set the hours you're open for bookings. Assign a schedule to each event type."
      />
      <FocusDefense />
      <SchedulesManager
        initialSchedules={summaries.map(({ id, name, isDefault, ruleCount }) => ({
          id,
          name,
          isDefault,
          ruleCount,
        }))}
        initialSelected={selected.id}
        initialDetail={{ timezone: detail?.timezone ?? "UTC", days, overrides }}
      />
      <TimeBlocks />
    </>
  );
}
