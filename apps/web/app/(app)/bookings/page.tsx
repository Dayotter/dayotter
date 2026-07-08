import { EmptyState, PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { desc, eq, getDb, schema } from "@calsync/db";
import { DateTime } from "luxon";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  pending: "bg-[var(--color-mint)]/15 text-[var(--color-mint)]",
  cancelled: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  rejected: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

export default async function BookingsPage() {
  const session = await getSession();
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";

  const bookings = await getDb().query.bookings.findMany({
    where: eq(schema.bookings.hostId, session!.user.id),
    orderBy: desc(schema.bookings.startsAt),
    limit: 50,
    with: { attendees: true },
  });

  return (
    <>
      <PageHeader title="Bookings" description="Everything scheduled with you." />
      {bookings.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="When someone books one of your event types, it appears here."
        />
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Card key={b.id} className="flex items-center gap-4 px-4 py-3">
              <div className="w-28 shrink-0 text-sm">
                <p className="font-medium">
                  {DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("LLL d")}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("h:mm a")}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.title}</p>
                <p className="truncate text-xs text-[var(--color-muted)]">
                  {b.attendees.map((a) => a.name ?? a.email).join(", ") || "No attendees"}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                  STATUS_STYLES[b.status] ??
                    "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
                )}
              >
                {b.status}
              </span>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
