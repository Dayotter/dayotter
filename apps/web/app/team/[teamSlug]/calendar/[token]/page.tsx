import { TeamScheduleView } from "@/components/team-schedule-view";
import { loadSharedTeamCalendar } from "@/lib/booking/shared-team-calendar";
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
  const data = await loadSharedTeamCalendar(teamSlug, token);
  if (!data) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Team availability
        </p>
        <h1 className="text-2xl font-semibold text-[var(--color-text)]">{data.team.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          When the team is busy over the next 7 days, shown in {data.timezone.replace(/_/g, " ")}.
        </p>
      </header>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)]">
        <TeamScheduleView
          schedule={data.schedule}
          timezone={data.timezone}
          rangeStart={data.rangeStart}
        />
      </div>
    </main>
  );
}
