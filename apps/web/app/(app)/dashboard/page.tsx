import { CopyLinkButton } from "@/components/copy-link-button";
import { DashboardTour } from "@/components/dashboard-tour";
import { MeetingAssistant } from "@/components/meeting-assistant";
import { OverflowButton } from "@/components/overflow-button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PendingInvites } from "@/components/pending-invites";
import { ProactiveOtter } from "@/components/proactive-otter";
import { RunningLateButton } from "@/components/running-late-button";
import { SectionHeading } from "@/components/section-heading";
import { SetupChecklist } from "@/components/setup-checklist";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { aiEnabled } from "@/lib/ai/llm";
import { getSession } from "@/lib/auth/session";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { and, asc, eq, getDb, gt, gte, lte, schema } from "@dayotter/db";
import {
  BarChart3,
  CalendarClock,
  CalendarPlus,
  Clock3,
  ExternalLink,
  Plus,
  Radio,
  Video,
} from "lucide-react";
import { DateTime } from "luxon";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  const userId = session!.user.id;
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";

  const db = getDb();
  const now = new Date();
  const [user, upcoming, inProgress] = await Promise.all([
    db.query.users.findFirst({
      where: eq(schema.users.id, userId),
      columns: { handle: true },
    }),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, now),
      ),
      orderBy: asc(schema.bookings.startsAt),
      limit: 10,
      with: { attendees: true, eventType: { columns: { color: true } } },
    }),
    // A meeting happening right now (started, not yet ended) - the overflow case.
    db.query.bookings.findFirst({
      where: and(
        eq(schema.bookings.hostId, userId),
        eq(schema.bookings.status, "confirmed"),
        lte(schema.bookings.startsAt, now),
        gt(schema.bookings.endsAt, now),
      ),
      orderBy: asc(schema.bookings.startsAt),
      with: { eventType: { columns: { color: true } } },
    }),
  ]);

  // Setup progress - drives the "get bookable" checklist for new accounts.
  const [conns, defaultSchedule, activeEvents] = await Promise.all([
    db.query.calendarConnections.findMany({
      where: eq(schema.calendarConnections.userId, userId),
      columns: { id: true },
      limit: 1,
    }),
    db.query.schedules.findFirst({
      where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
      with: { availabilityRules: { columns: { id: true }, limit: 1 } },
    }),
    db.query.eventTypes.findMany({
      where: and(eq(schema.eventTypes.ownerId, userId), eq(schema.eventTypes.isActive, true)),
      columns: { id: true },
      limit: 1,
    }),
  ]);
  const hasCalendar = conns.length > 0;
  const hasHours = (defaultSchedule?.availabilityRules.length ?? 0) > 0;
  const hasEventType = activeEvents.length > 0;
  const setupComplete = hasCalendar && hasHours && hasEventType;

  // Glance stats - cheap, personal counts (not the Pro analytics). One query for
  // this week + today + the 30-day horizon, bucketed in the user's timezone.
  const zoneNow = DateTime.now().setZone(tz);
  const weekStart = zoneNow.startOf("week");
  const weekEnd = zoneNow.endOf("week");
  const dayStart = zoneNow.startOf("day");
  const dayEnd = zoneNow.endOf("day");
  const horizon = zoneNow.plus({ days: 30 });
  const statBookings = await db.query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, userId),
      eq(schema.bookings.status, "confirmed"),
      gte(schema.bookings.startsAt, weekStart.toJSDate()),
      lte(schema.bookings.startsAt, horizon.toJSDate()),
    ),
    columns: { startsAt: true, endsAt: true },
    limit: 300,
  });
  const inRange = (d: Date, a: DateTime, b: DateTime) => {
    const t = DateTime.fromJSDate(d).setZone(tz);
    return t >= a && t <= b;
  };
  const weekBookings = statBookings.filter((b) => inRange(b.startsAt, weekStart, weekEnd));
  const weekMinutes = weekBookings.reduce(
    (m, b) => m + (b.endsAt.getTime() - b.startsAt.getTime()) / 60_000,
    0,
  );
  const stats = {
    today: statBookings.filter((b) => inRange(b.startsAt, dayStart, dayEnd)).length,
    week: weekBookings.length,
    weekHours: Math.round((weekMinutes / 60) * 10) / 10,
    upcoming: statBookings.filter((b) => b.startsAt.getTime() >= now.getTime()).length,
  };
  const showStats = statBookings.length > 0;

  const QUICK_ACTIONS = [
    { href: "/event-types/new", label: "New booking type", icon: Plus },
    { href: "/availability", label: "Edit availability", icon: Clock3 },
    { href: "/settings/calendars", label: "Connect calendar", icon: CalendarPlus },
    { href: "/analytics", label: "View analytics", icon: BarChart3 },
  ];

  const handle = user?.handle ?? null;
  const appHost = (process.env.APP_URL ?? "").replace(/^https?:\/\//, "").replace(/\/$/, "");
  const linkDisplay = handle ? (appHost ? `${appHost}/${handle}` : `/${handle}`) : null;
  const next = upcoming[0];
  // Show the overflow nudge only when a back-to-back meeting follows the one in
  // progress within 90 minutes of it ending.
  const nextAfterInProgress =
    inProgress &&
    next &&
    next.startsAt.getTime() > inProgress.endsAt.getTime() &&
    next.startsAt.getTime() - inProgress.endsAt.getTime() < 90 * 60_000;
  // Show the "running late" nudge when the next meeting is about to start (or just
  // did) - the window where you'd realistically be running behind.
  const nextIsImminent = next
    ? next.startsAt.getTime() - Date.now() < 20 * 60_000 &&
      next.startsAt.getTime() - Date.now() > -30 * 60_000
    : false;
  const firstName = (session!.user.name ?? "there").split(" ")[0];

  return (
    <>
      <PageHeader
        eyebrow="Your day"
        title={`Good to see you, ${firstName}`}
        description="Here's what's on your calendar."
      />

      <SetupChecklist hasCalendar={hasCalendar} hasHours={hasHours} hasEventType={hasEventType} />
      <DashboardTour />

      <ProactiveOtter />

      {showStats ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Today", value: stats.today, hint: "meetings", accent: true },
            { label: "This week", value: stats.week, hint: "meetings", accent: false },
            {
              label: "Hours this week",
              value: stats.weekHours,
              hint: "in meetings",
              accent: false,
            },
            { label: "Next 30 days", value: stats.upcoming, hint: "upcoming", accent: false },
          ].map((s) => (
            <Card key={s.label} interactive className="p-5">
              <span className="eyebrow">{s.label}</span>
              <p
                className={`mt-2 font-display text-[2rem] leading-none tabular-nums ${
                  s.accent ? "text-[var(--color-accent)]" : ""
                }`}
              >
                {s.value}
              </p>
              <p className="mt-1.5 text-xs text-[var(--color-faint)]">{s.hint}</p>
            </Card>
          ))}
        </div>
      ) : null}

      {handle ? (
        <Card className="mb-6 overflow-hidden">
          <div
            data-tour="link"
            className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-[var(--color-accent-soft)] to-[var(--color-surface)] p-5"
          >
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-accent)]">
                Your booking link
              </p>
              <p className="mt-1 truncate font-display text-xl">{linkDisplay}</p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Share it and people pick a time you're free - no back-and-forth.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CopyLinkButton path={`/${handle}`} />
              <Link
                href={`/${handle}`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                <ExternalLink size={15} /> View
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm font-medium transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-surface-2)]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
              <Icon size={17} />
            </span>
            {label}
          </Link>
        ))}
      </div>

      <PendingInvites aiEnabled={aiEnabled} />

      {inProgress ? (
        <Card className="mb-6 border-[var(--color-border-strong)] bg-gradient-to-br from-[var(--color-surface-2)] to-[var(--color-surface)]">
          <div className="flex items-center justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-accent)]">
                <Radio size={13} /> Happening now
              </p>
              <p className="mt-1 truncate text-lg font-semibold">{inProgress.title}</p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                until {DateTime.fromJSDate(inProgress.endsAt).setZone(tz).toFormat("h:mm a")}
                {nextAfterInProgress ? " · another meeting right after" : ""}
              </p>
            </div>
            {nextAfterInProgress ? <OverflowButton uid={inProgress.uid} /> : null}
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
            <div className="flex items-center gap-2">
              {nextIsImminent ? <RunningLateButton uid={next.uid} /> : null}
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
          </div>
        </Card>
      ) : null}

      {aiEnabled && next ? <MeetingAssistant uid={next.uid} title={next.title} /> : null}

      <SectionHeading eyebrow="Agenda" title="Upcoming" />
      {upcoming.length === 0 ? (
        <EmptyState
          title="Calm waters"
          description={
            conns.length > 0
              ? "Your calendar's synced. Share your booking link and new meetings will surface here."
              : "Once your calendars are connected and people start booking, meetings surface here."
          }
          action={
            conns.length > 0 ? (
              handle ? (
                <CopyLinkButton path={`/${handle}`} label="Copy your booking link" />
              ) : (
                <Link href="/event-types" className={buttonVariants({ variant: "primary" })}>
                  Create a booking type
                </Link>
              )
            ) : (
              <Link href="/settings/calendars" className={buttonVariants({ variant: "primary" })}>
                Connect a calendar
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          {upcoming.map((b) => (
            <Card key={b.id} interactive className="flex items-center gap-4 px-4 py-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md text-white"
                style={{ backgroundColor: eventColorVar(b.eventType?.color) }}
              >
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
