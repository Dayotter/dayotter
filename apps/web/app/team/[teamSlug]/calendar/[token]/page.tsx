import { TeamScheduleView } from "@/components/team-schedule-view";
import { teamSchedule } from "@/lib/booking/team-schedule";
import { eq, getDb, schema } from "@dayotter/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team availability",
  // A capability-token URL - keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * Public, read-only view of a team's combined availability over the next week,
 * reachable only via the team's unguessable share token (owner/admin generates it
 * in the team settings; rotating it revokes old links). Privacy-preserving: it
 * shows only WHEN each member is busy - no meeting titles, no email addresses.
 */
export default async function TeamSharedCalendarPage({
  params,
}: {
  params: Promise<{ teamSlug: string; token: string }>;
}) {
  const { teamSlug, token } = await params;
  if (!token) notFound();

  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.publicScheduleToken, token),
    with: { members: { with: { user: true } } },
  });
  // Token is the capability; the slug must also match so the URL is coherent.
  if (!team || !team.publicScheduleToken || team.slug !== teamSlug) notFound();

  const owner = team.members.find((m) => m.role === "owner");
  const tz = (owner?.user as { timezone?: string } | undefined)?.timezone ?? "UTC";

  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 86_400_000);
  const raw = await teamSchedule(
    team.members.map((m) => ({
      userId: m.userId,
      name: m.user?.name ?? "Member",
      email: m.user?.email ?? "",
    })),
    now,
    weekEnd,
  );
  // Public link → busy/free only. Drop meeting titles and emails.
  const schedule = raw.map((m) => ({
    userId: m.userId,
    name: m.name,
    email: "",
    intervals: m.intervals.map((i) => ({ start: i.start, end: i.end })),
  }));

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Team availability
        </p>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{team.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          When the team is busy over the next 7 days, shown in {tz.replace(/_/g, " ")}.
        </p>
      </header>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <TeamScheduleView schedule={schedule} timezone={tz} rangeStart={now} />
      </div>
    </main>
  );
}
