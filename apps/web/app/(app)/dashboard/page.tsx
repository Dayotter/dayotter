import { CopyLinkButton } from "@/components/copy-link-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { and, asc, eq, getDb, gte, schema } from "@calsync/db";
import { CalendarClock, ExternalLink, Video } from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const userId = session!.user.id;
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";

  const db = getDb();
  const [user, upcoming] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { handle: true },
    }),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, new Date()),
      ),
      orderBy: asc(schema.bookings.startsAt),
      limit: 10,
      with: { attendees: true },
    }),
  ]);

  const handle = user?.handle ?? null;
  const next = upcoming[0];
  const firstName = (session!.user.name ?? "there").split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Good to see you, ${firstName}`}
        description="Here's what's on your calendar."
      />

      {handle ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
              Your booking page
            </p>
            <p className="mt-0.5 truncate text-sm text-[var(--color-text)]">/{handle}</p>
          </div>
          <div className="flex items-center gap-3">
            <CopyLinkButton path={`/${handle}`} />
            <Link
              href={`/${handle}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
            >
              View <ExternalLink size={13} />
            </Link>
          </div>
        </Card>
      ) : null}

      {next ? (
        <Card className="mb-6 border-[var(--color-border-strong)] bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface)]">
          <div className="flex items-center justify-between p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-mint)]">
                Next up
              </p>
              <p className="mt-1 text-lg font-semibold">{next.title}</p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                {DateTime.fromJSDate(next.startsAt).setZone(tz).toFormat("cccc, LLL d · h:mm a")} –{" "}
                {DateTime.fromJSDate(next.endsAt).setZone(tz).toFormat("h:mm a")}
              </p>
            </div>
            {next.meetingUrl ? (
              <a
                href={next.meetingUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "primary" })}
              >
                <Video size={16} /> Join
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      <h2 className="mb-3 text-sm font-semibold text-[var(--color-muted)]">Upcoming</h2>
      {upcoming.length === 0 ? (
        <EmptyState
          title="Nothing scheduled yet"
          description="Once your calendars are connected and people start booking, meetings show up here."
          action={
            <Link href="/settings/calendars" className={buttonVariants({ variant: "primary" })}>
              Connect a calendar
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => (
            <Card key={b.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-accent)]">
                <CalendarClock size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{b.title}</p>
                <p className="truncate text-xs text-[var(--color-muted)]">
                  {b.attendees.map((a) => a.name ?? a.email).join(", ") || "No attendees"}
                </p>
              </div>
              <p className="shrink-0 text-sm text-[var(--color-muted)]">
                {DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("LLL d, h:mm a")}
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
