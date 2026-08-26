import { eq, getDb, schema } from "@dayotter/db";
import { teamSchedule } from "./team-schedule";

export interface SharedTeamCalendar {
  team: { id: string; name: string; slug: string };
  timezone: string;
  rangeStart: Date;
  /** Busy/free only - meeting titles and emails are stripped for the public view. */
  schedule: {
    userId: string;
    name: string;
    email: string;
    intervals: { start: Date; end: Date }[];
  }[];
}

/**
 * Load a team's public shared-availability calendar by (slug, token), or null if
 * the token doesn't match or sharing is off. The token is the capability; the
 * slug must also match so the URL is coherent. Privacy-preserving: the returned
 * schedule carries busy/free blocks only - no meeting titles, no email addresses.
 * Shared by the public page and the chrome-less embed page.
 */
export async function loadSharedTeamCalendar(
  teamSlug: string,
  token: string,
): Promise<SharedTeamCalendar | null> {
  if (!token) return null;
  const db = getDb();
  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.publicScheduleToken, token),
    with: { members: { with: { user: true } } },
  });
  if (!team || !team.publicScheduleToken || team.slug !== teamSlug) return null;

  const owner = team.members.find((m) => m.role === "owner");
  const timezone = (owner?.user as { timezone?: string } | undefined)?.timezone ?? "UTC";

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

  return {
    team: { id: team.id, name: team.name, slug: team.slug },
    timezone,
    rangeStart: now,
    schedule: raw.map((m) => ({
      userId: m.userId,
      name: m.name,
      email: "",
      intervals: m.intervals.map((i) => ({ start: i.start, end: i.end })),
    })),
  };
}
