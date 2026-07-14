import { logger } from "@dayotter/core";
import { and, eq, getDb, gte, inArray, lt, schema } from "@dayotter/db";
import { sendEmail, teamBriefing } from "@dayotter/emails";
import { deliverUserReminder } from "@dayotter/notifications";
import { DateTime } from "luxon";

/** Same forgiving send window as the personal briefing. */
const SEND_WINDOW_HOURS = 3;

function focusLabel(totalMinutes: number): string | undefined {
  if (totalMinutes <= 0) return undefined;
  if (totalMinutes >= 90) {
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours} hours of focus held across the team`;
  }
  return `${totalMinutes} minutes of focus held across the team`;
}

/**
 * Shared daily team digest. For each team that opted in, once the reference
 * member's local time crosses the chosen hour, send everyone (or just admins) a
 * summary of the team's day: total meetings, load per member, and focus held.
 * Idempotent per local day via `briefingLastSent`, so safe on every tick.
 */
export async function sendDueTeamBriefings(now = new Date()): Promise<number> {
  const db = getDb();
  const prefs = await db.query.teamPreferences.findMany({
    where: eq(schema.teamPreferences.briefingEnabled, true),
    columns: {
      teamId: true,
      briefingHour: true,
      briefingLastSent: true,
      briefingRecipients: true,
    },
  });
  if (prefs.length === 0) return 0;

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  let sent = 0;

  for (const pref of prefs) {
    const team = await db.query.teams.findFirst({
      where: eq(schema.teams.id, pref.teamId),
      columns: { id: true, name: true },
      with: {
        members: {
          with: { user: { columns: { id: true, name: true, email: true, timezone: true } } },
        },
      },
    });
    if (!team || team.members.length === 0) continue;

    // Reference timezone: an owner/admin's tz, else the first member's.
    const admins = team.members.filter((m) => m.role === "owner" || m.role === "admin");
    const reference = (admins[0] ?? team.members[0])?.user;
    const tz = reference?.timezone || "UTC";
    const local = DateTime.fromJSDate(now).setZone(tz);
    const today = local.toFormat("yyyy-LL-dd");

    // Once per local day, only inside the morning window.
    if (pref.briefingLastSent === today) continue;
    if (local.hour < pref.briefingHour || local.hour >= pref.briefingHour + SEND_WINDOW_HOURS) {
      continue;
    }

    const dayStart = local.startOf("day").toJSDate();
    const dayEnd = local.endOf("day").toJSDate();
    const memberIds = team.members.map((m) => m.userId);

    // Today's confirmed meetings hosted by any member, plus focus blocks held.
    const [bookings, blocks] = await Promise.all([
      db.query.bookings.findMany({
        where: and(
          inArray(schema.bookings.hostId, memberIds),
          eq(schema.bookings.status, "confirmed"),
          gte(schema.bookings.startsAt, dayStart),
          lt(schema.bookings.startsAt, dayEnd),
        ),
        columns: { hostId: true },
      }),
      db.query.timeBlocks.findMany({
        where: and(
          inArray(schema.timeBlocks.userId, memberIds),
          eq(schema.timeBlocks.kind, "focus"),
          gte(schema.timeBlocks.startsAt, dayStart),
          lt(schema.timeBlocks.startsAt, dayEnd),
        ),
        columns: { startsAt: true, endsAt: true },
      }),
    ]);

    const countByHost = new Map<string, number>();
    for (const b of bookings) countByHost.set(b.hostId, (countByHost.get(b.hostId) ?? 0) + 1);

    const perMember = team.members
      .map((m) => ({
        name: m.user?.name || m.user?.email || "Member",
        count: countByHost.get(m.userId) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const focusMinutes = blocks.reduce(
      (sum, b) =>
        sum + Math.max(0, Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000)),
      0,
    );
    const focus = focusLabel(focusMinutes);
    const dateLabel = local.toFormat("cccc, LLLL d");

    // Recipients: owner/admins, or all members.
    const recipients =
      pref.briefingRecipients === "all"
        ? team.members
        : team.members.filter((m) => m.role === "owner" || m.role === "admin");

    const busiest = perMember[0];
    const summaryBody =
      bookings.length === 0
        ? `A clear team day.${focus ? ` ${focus}.` : ""}`
        : `${bookings.length} meeting${bookings.length === 1 ? "" : "s"} across the team today${busiest && busiest.count > 0 ? `, most on ${busiest.name} (${busiest.count})` : ""}.`;

    for (const member of recipients) {
      const user = member.user;
      if (!user?.email) continue;
      try {
        await sendEmail({
          ...teamBriefing({
            name: user.name?.split(" ")[0] ?? "",
            teamName: team.name,
            dateLabel,
            totalMeetings: bookings.length,
            perMember,
            focusLabel: focus,
            manageUrl: `${appUrl}/teams/${team.id}`,
          }),
          to: user.email,
        });
      } catch (err) {
        logger.error("team briefing email failed", {
          event: "team_briefing_email_failed",
          teamId: team.id,
          userId: user.id,
          err,
        });
      }
      await deliverUserReminder(member.userId, {
        title: `${team.name} - today`,
        body: summaryBody,
        url: `${appUrl}/teams/${team.id}`,
      }).catch(() => 0);
    }

    await db
      .insert(schema.teamPreferences)
      .values({ teamId: team.id, briefingLastSent: today })
      .onConflictDoUpdate({
        target: schema.teamPreferences.teamId,
        set: { briefingLastSent: today },
      });
    sent += 1;
  }

  if (sent > 0) {
    logger.info("team briefings sent", { event: "team_briefings_sent", count: sent });
  }
  return sent;
}
