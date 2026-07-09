import { AvailabilityEditor } from "@/components/availability-editor";
import { FocusDefense } from "@/components/focus-defense";
import { PageHeader } from "@/components/page-header";
import { TimeBlocks } from "@/components/time-blocks";
import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { and, eq, getDb, schema } from "@calsync/db";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const session = await getSession();
  const userId = session!.user.id;

  // Guarantee a default schedule exists so the editor always has somewhere to save.
  await ensureUserWorkspace(userId);

  const schedule = await getDb().query.schedules.findFirst({
    where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
    with: { availabilityRules: true, dateOverrides: true },
  });

  const days: { start: string; end: string }[][] = [[], [], [], [], [], [], []];
  for (const r of schedule?.availabilityRules ?? []) {
    days[r.dayOfWeek]!.push({ start: r.startTime.slice(0, 5), end: r.endTime.slice(0, 5) });
  }
  for (const list of days) list.sort((a, b) => a.start.localeCompare(b.start));

  const overrides = (schedule?.dateOverrides ?? [])
    .map((o) => ({
      date: o.date,
      start: o.startTime ? o.startTime.slice(0, 5) : null,
      end: o.endTime ? o.endTime.slice(0, 5) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader
        title="Availability"
        description="Set the hours you're open for bookings. Applies to all your event types."
      />
      <FocusDefense />
      <AvailabilityEditor initial={{ timezone: schedule?.timezone ?? "UTC", days, overrides }} />
      <TimeBlocks />
    </>
  );
}
