import { EmbedBridge } from "@/components/embed-bridge";
import { TeamScheduleView } from "@/components/team-schedule-view";
import { loadSharedTeamCalendar } from "@/lib/booking/shared-team-calendar";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Team availability",
  robots: { index: false, follow: false },
};

/**
 * Chrome-less version of the shared team availability calendar, for embedding in
 * an iframe (via the copyable snippet in team settings, or embed.js). Same
 * token-gated, privacy-stripped data as the public page, minus the site shell,
 * plus an EmbedBridge that relays height to the parent so the frame can auto-size.
 * `?theme=light|dark|auto` matches the booking embed.
 */
export default async function EmbedTeamCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teamSlug, token } = await params;
  const data = await loadSharedTeamCalendar(teamSlug, token);
  if (!data) notFound();

  const themeParam = (await searchParams).theme;
  const theme = themeParam === "dark" ? "dark" : themeParam === "light" ? "light" : "auto";

  return (
    <div className="bg-[var(--color-bg)] p-3">
      <EmbedBridge theme={theme} />
      <TeamScheduleView
        schedule={data.schedule}
        timezone={data.timezone}
        rangeStart={data.rangeStart}
      />
    </div>
  );
}
