import { BookingsWorkspace, type HistoryBooking } from "@/components/bookings-workspace";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/auth/session";
import { desc, eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const session = await getSession();
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";

  const rows = await getDb().query.bookings.findMany({
    where: eq(schema.bookings.hostId, session!.user.id),
    orderBy: desc(schema.bookings.startsAt),
    limit: 100,
    with: { attendees: true, eventType: { columns: { color: true } } },
  });

  const history: HistoryBooking[] = rows.map((b) => ({
    id: b.id,
    uid: b.uid,
    title: b.title,
    startsAt: b.startsAt.toISOString(),
    endsAt: b.endsAt.toISOString(),
    status: b.status,
    color: b.eventType?.color ?? null,
    attendees: b.attendees.map((a) => a.name ?? a.email),
  }));

  return (
    <>
      <PageHeader
        eyebrow="Your calendar"
        title="Bookings"
        description="Everything scheduled with you."
      />
      <BookingsWorkspace tz={tz} history={history} />
    </>
  );
}
