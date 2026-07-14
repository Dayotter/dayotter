import { logger } from "@dayotter/core";
import { and, asc, eq, getDb, gte, inArray, lt, schema } from "@dayotter/db";
import { dailyBriefing, sendEmail } from "@dayotter/emails";
import { deliverUserReminder } from "@dayotter/notifications";
import { DateTime } from "luxon";

/**
 * How many hours after the configured briefing hour we'll still send. Keeps a
 * user who enables briefings in the afternoon from getting a "morning" briefing
 * at 3pm — if we miss the window (worker down, just enabled), it waits for
 * tomorrow. The maintenance tick runs every ~15 min, so the real send lands
 * within a quarter hour of the chosen hour.
 */
const SEND_WINDOW_HOURS = 3;

function focusLabel(totalMinutes: number): string | undefined {
  if (totalMinutes <= 0) return undefined;
  if (totalMinutes >= 90) {
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    return `${hours % 1 === 0 ? hours.toFixed(0) : hours} hours of focus held`;
  }
  return `${totalMinutes} minutes of focus held`;
}

/**
 * Daily "morning briefing" — for each user who opted in, once their local time
 * has crossed their chosen hour, send a calm summary of the day (today's
 * meetings + focus time) over email and their configured channels. Idempotent
 * per local day via `briefingLastSent`, so it's safe on every maintenance tick.
 */
export async function sendDueBriefings(now = new Date()): Promise<number> {
  const db = getDb();
  const prefs = await db.query.userPreferences.findMany({
    where: eq(schema.userPreferences.briefingEnabled, true),
    columns: { userId: true, briefingHour: true, briefingLastSent: true },
  });
  if (prefs.length === 0) return 0;

  const users = await db.query.users.findMany({
    where: inArray(
      schema.users.id,
      prefs.map((p) => p.userId),
    ),
    columns: { id: true, name: true, email: true, timezone: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  let sent = 0;
  for (const pref of prefs) {
    const user = userById.get(pref.userId);
    if (!user) continue;
    const tz = user.timezone || "UTC";
    const local = DateTime.fromJSDate(now).setZone(tz);
    const today = local.toFormat("yyyy-LL-dd");

    // Once per local day, only inside the morning window.
    if (pref.briefingLastSent === today) continue;
    if (local.hour < pref.briefingHour || local.hour >= pref.briefingHour + SEND_WINDOW_HOURS) {
      continue;
    }

    const dayStart = local.startOf("day").toJSDate();
    const dayEnd = local.endOf("day").toJSDate();

    const bookings = await db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, pref.userId),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, dayStart),
        lt(schema.bookings.startsAt, dayEnd),
      ),
      orderBy: asc(schema.bookings.startsAt),
      columns: { title: true, startsAt: true },
    });

    const blocks = await db.query.timeBlocks.findMany({
      where: and(
        eq(schema.timeBlocks.userId, pref.userId),
        eq(schema.timeBlocks.kind, "focus"),
        gte(schema.timeBlocks.startsAt, dayStart),
        lt(schema.timeBlocks.startsAt, dayEnd),
      ),
      columns: { startsAt: true, endsAt: true },
    });
    const focusMinutes = blocks.reduce(
      (sum, b) =>
        sum + Math.max(0, Math.round((b.endsAt.getTime() - b.startsAt.getTime()) / 60_000)),
      0,
    );
    const focus = focusLabel(focusMinutes);

    const meetings = bookings.map((b) => ({
      time: DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("h:mm a"),
      title: b.title,
    }));

    // Email (the reliable baseline for an opt-in daily summary).
    try {
      await sendEmail({
        ...dailyBriefing({
          name: user.name?.split(" ")[0] ?? "",
          dateLabel: local.toFormat("cccc, LLLL d"),
          meetings,
          focusLabel: focus,
          manageUrl: appUrl,
        }),
        to: user.email,
      });
    } catch (err) {
      logger.error("briefing email failed", {
        event: "briefing_email_failed",
        userId: pref.userId,
        err,
      });
    }

    // Plus the user's configured channels (SMS / WhatsApp / Slack / push).
    const first = meetings[0];
    const body =
      meetings.length === 0
        ? `A clear calendar today.${focus ? ` ${focus}.` : ""}`
        : `${meetings.length} meeting${meetings.length === 1 ? "" : "s"} today${first ? `, first at ${first.time} — ${first.title}` : ""}.${focus ? ` ${focus}.` : ""}`;
    await deliverUserReminder(pref.userId, {
      title: "Your morning briefing",
      body,
      url: appUrl,
    }).catch(() => 0);

    await db
      .update(schema.userPreferences)
      .set({ briefingLastSent: today })
      .where(eq(schema.userPreferences.userId, pref.userId));
    sent += 1;
  }

  if (sent > 0) {
    logger.info("morning briefings sent", { event: "briefings_sent", count: sent });
  }
  return sent;
}
