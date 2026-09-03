import { hmacSha256hex, logger } from "@dayotter/core";
import { and, eq, getDb, gte, inArray, lt, lte, ne, schema, sql } from "@dayotter/db";
import {
  activationConnectCalendar,
  activationShareLink,
  firstBookingCelebration,
  sendEmail,
  weeklyDigest,
} from "@dayotter/emails";
import { DateTime } from "luxon";

/**
 * Off by default. Set LIFECYCLE_EMAILS=1 to turn the activation nudges on - a
 * deliberate gate so a deploy never starts emailing your existing users until
 * you decide to. Each nudge is sent to a given user at most once (unique
 * (user, kind) row acts as the send-lock).
 */
const ENABLED = process.env.LIFECYCLE_EMAILS === "1";
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
/** Give a new signup room to activate on their own before nudging. */
const MIN_AGE_MS = 2 * 86_400_000;

// ---- Over-send safety valves (belt-and-suspenders on top of the per-(user,kind)
// ledger, which is the real "at most once" guarantee). ----
/** Hard ceiling on total lifecycle emails sent per UTC day, across all kinds and
 * runs. A runaway bug can never blast the whole list. Override with
 * LIFECYCLE_EMAILS_DAILY_CAP. */
const DAILY_CAP = Number(process.env.LIFECYCLE_EMAILS_DAILY_CAP) || 500;
/** Ceiling on emails a single scan can send, so one tick can't burst. */
const MAX_PER_RUN = 150;

/**
 * How many lifecycle emails may still go out this tick: the smaller of the
 * per-run cap and (daily cap − already sent today). The `lifecycle_emails` ledger
 * IS the record of every send, so counting today's rows is exact - no separate
 * counter to drift. Returns 0 when the day's budget is spent.
 */
async function remainingBudget(db: ReturnType<typeof getDb>): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.lifecycleEmails)
    .where(gte(schema.lifecycleEmails.createdAt, startOfDay));
  const sentToday = row?.n ?? 0;
  return Math.max(0, Math.min(MAX_PER_RUN, DAILY_CAP - sentToday));
}

export type NudgeKind = "connect_calendar" | "share_link";

/**
 * Decide which activation nudge (if any) a user is due, from their current state.
 * Pure (no I/O), so the targeting rules are trivially testable in isolation:
 *  - no calendar connected yet  -> nudge them to connect one (top-of-funnel leak)
 *  - calendar connected but never booked (and they have a shareable handle)
 *    -> nudge them to share their link (the sharpest activation leak)
 * Each kind fires once; `sent` is the set of kinds already delivered.
 */
export function pickActivationNudge(u: {
  hasCalendar: boolean;
  meetings: number;
  hasHandle: boolean;
  sent: Set<NudgeKind>;
}): NudgeKind | null {
  if (!u.hasCalendar) return u.sent.has("connect_calendar") ? null : "connect_calendar";
  if (u.meetings === 0 && u.hasHandle && !u.sent.has("share_link")) return "share_link";
  return null;
}

function unsubscribeUrl(userId: string): string {
  // HMAC over the id so the link needs no login and can't be guessed/forged.
  const token = hmacSha256hex(process.env.AUTH_SECRET ?? "", `unsub:${userId}`);
  return `${APP_URL.replace(/\/$/, "")}/api/email/unsubscribe?u=${userId}&t=${token}`;
}

/**
 * Scan for users due an activation nudge and send it. Idempotent: the send is
 * locked by inserting the (user, kind) ledger row first, so re-runs (and the
 * maintenance tick calling this every cycle) never double-send. Returns the
 * number of emails sent.
 */
export async function sendActivationNudges(now = new Date()): Promise<number> {
  if (!ENABLED) return 0;
  const db = getDb();
  let budget = await remainingBudget(db);
  if (budget <= 0) return 0;
  const cutoff = new Date(now.getTime() - MIN_AGE_MS);

  // Users old enough to nudge who still receive product emails.
  const candidates = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      handle: schema.users.handle,
    })
    .from(schema.users)
    .innerJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id))
    .where(and(eq(schema.userPreferences.productEmails, true), lt(schema.users.createdAt, cutoff)));
  if (candidates.length === 0) return 0;

  const ids = candidates.map((c) => c.id);
  const [withCal, meetingRows, sentRows] = await Promise.all([
    db
      .selectDistinct({ userId: schema.calendarConnections.userId })
      .from(schema.calendarConnections)
      .where(inArray(schema.calendarConnections.userId, ids)),
    db
      .select({ hostId: schema.bookings.hostId, n: sql<number>`count(*)::int` })
      .from(schema.bookings)
      .where(and(inArray(schema.bookings.hostId, ids), ne(schema.bookings.status, "cancelled")))
      .groupBy(schema.bookings.hostId),
    db
      .select({ userId: schema.lifecycleEmails.userId, kind: schema.lifecycleEmails.kind })
      .from(schema.lifecycleEmails)
      .where(inArray(schema.lifecycleEmails.userId, ids)),
  ]);

  const hasCal = new Set(withCal.map((r) => r.userId));
  const meetings = new Map(meetingRows.map((r) => [r.hostId, r.n]));
  const sentByUser = new Map<string, Set<NudgeKind>>();
  for (const r of sentRows) {
    const set = sentByUser.get(r.userId) ?? new Set<NudgeKind>();
    set.add(r.kind as NudgeKind);
    sentByUser.set(r.userId, set);
  }

  let sent = 0;
  for (const u of candidates) {
    const kind = pickActivationNudge({
      hasCalendar: hasCal.has(u.id),
      meetings: meetings.get(u.id) ?? 0,
      hasHandle: Boolean(u.handle),
      sent: sentByUser.get(u.id) ?? new Set(),
    });
    if (!kind) continue;
    if (budget <= 0) break;

    // Claim the send first (unique index = the lock); skip if another run took it.
    const claimed = await db
      .insert(schema.lifecycleEmails)
      .values({ userId: u.id, kind })
      .onConflictDoNothing()
      .returning({ id: schema.lifecycleEmails.id });
    if (claimed.length === 0) continue;

    const data = {
      name: u.name ?? "",
      bookingUrl: `${APP_URL.replace(/\/$/, "")}/${u.handle ?? ""}`,
      manageUrl: `${APP_URL.replace(/\/$/, "")}/dashboard`,
      unsubscribeUrl: unsubscribeUrl(u.id),
    };
    const email =
      kind === "connect_calendar" ? activationConnectCalendar(data) : activationShareLink(data);
    try {
      await sendEmail({ to: u.email, ...email });
      sent += 1;
      budget -= 1;
      logger.info("lifecycle email sent", { event: "lifecycle_email_sent", userId: u.id, kind });
    } catch (err) {
      logger.error("lifecycle email failed", {
        event: "lifecycle_email_failed",
        userId: u.id,
        kind,
        err,
      });
    }
  }
  return sent;
}

/** APP_URL without a trailing slash. */
function base(): string {
  return APP_URL.replace(/\/$/, "");
}

/**
 * Celebrate a host's FIRST booking, once. Scoped to hosts whose first booking was
 * created recently, so turning the feature on doesn't retro-celebrate months-old
 * bookings. Fires on the maintenance tick (a few minutes' latency is fine).
 */
export async function sendFirstBookingCelebrations(now = new Date()): Promise<number> {
  if (!ENABLED) return 0;
  const db = getDb();
  let budget = await remainingBudget(db);
  if (budget <= 0) return 0;
  const cutoff = new Date(now.getTime() - 14 * 86_400_000);

  const firstByHost = await db
    .select({
      hostId: schema.bookings.hostId,
      first: sql<string>`min(${schema.bookings.createdAt})`,
    })
    .from(schema.bookings)
    .where(ne(schema.bookings.status, "cancelled"))
    .groupBy(schema.bookings.hostId);
  const ids = firstByHost.filter((r) => new Date(r.first) >= cutoff).map((r) => r.hostId);
  if (ids.length === 0) return 0;

  const [optedIn, sentRows] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        handle: schema.users.handle,
      })
      .from(schema.users)
      .innerJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id))
      .where(and(inArray(schema.users.id, ids), eq(schema.userPreferences.productEmails, true))),
    db
      .select({ userId: schema.lifecycleEmails.userId })
      .from(schema.lifecycleEmails)
      .where(
        and(
          inArray(schema.lifecycleEmails.userId, ids),
          eq(schema.lifecycleEmails.kind, "first_booking"),
        ),
      ),
  ]);
  const already = new Set(sentRows.map((r) => r.userId));

  let sent = 0;
  for (const u of optedIn) {
    if (already.has(u.id)) continue;
    if (budget <= 0) break;
    const claimed = await db
      .insert(schema.lifecycleEmails)
      .values({ userId: u.id, kind: "first_booking" })
      .onConflictDoNothing()
      .returning({ id: schema.lifecycleEmails.id });
    if (claimed.length === 0) continue;
    try {
      await sendEmail({
        to: u.email,
        ...firstBookingCelebration({
          name: u.name ?? "",
          bookingUrl: `${base()}/${u.handle ?? ""}`,
          manageUrl: `${base()}/dashboard`,
          unsubscribeUrl: unsubscribeUrl(u.id),
        }),
      });
      sent += 1;
      budget -= 1;
      logger.info("lifecycle email sent", {
        event: "lifecycle_email_sent",
        userId: u.id,
        kind: "first_booking",
      });
    } catch (err) {
      logger.error("lifecycle email failed", {
        event: "lifecycle_email_failed",
        userId: u.id,
        kind: "first_booking",
        err,
      });
    }
  }
  return sent;
}

/**
 * Weekly "here's your week" digest. Sent Monday morning in each user's own
 * timezone, once per ISO week (the ledger kind carries the week, so it can't
 * double-send). Summarizes the week just gone (meetings hosted + hours + focus
 * time protected) and what's on the books for the week ahead.
 */
export async function sendWeeklyDigests(now = new Date()): Promise<number> {
  if (!ENABLED) return 0;
  const db = getDb();
  let budget = await remainingBudget(db);
  if (budget <= 0) return 0;

  const users = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      timezone: schema.users.timezone,
    })
    .from(schema.users)
    .innerJoin(schema.userPreferences, eq(schema.userPreferences.userId, schema.users.id))
    .where(eq(schema.userPreferences.productEmails, true));
  if (users.length === 0) return 0;

  let sent = 0;
  for (const u of users) {
    const tz = u.timezone || "UTC";
    const local = DateTime.fromJSDate(now).setZone(tz);
    // Monday, from 08:00 local. (Luxon weekday: 1 = Monday.)
    if (local.weekday !== 1 || local.hour < 8) continue;
    if (budget <= 0) break;

    const kind = `weekly_digest:${local.toFormat("kkkk-'W'WW")}`;
    const claimed = await db
      .insert(schema.lifecycleEmails)
      .values({ userId: u.id, kind })
      .onConflictDoNothing()
      .returning({ id: schema.lifecycleEmails.id });
    if (claimed.length === 0) continue;

    const weekStart = local.startOf("week"); // Monday 00:00 local
    const lastWeekStart = weekStart.minus({ weeks: 1 });
    const [pastMeetings, focusBlocks, upcomingRows] = await Promise.all([
      db.query.bookings.findMany({
        where: and(
          eq(schema.bookings.hostId, u.id),
          ne(schema.bookings.status, "cancelled"),
          gte(schema.bookings.startsAt, lastWeekStart.toJSDate()),
          lt(schema.bookings.startsAt, weekStart.toJSDate()),
        ),
        columns: { startsAt: true, endsAt: true },
      }),
      db.query.timeBlocks.findMany({
        where: and(
          eq(schema.timeBlocks.userId, u.id),
          gte(schema.timeBlocks.startsAt, lastWeekStart.toJSDate()),
          lt(schema.timeBlocks.startsAt, weekStart.toJSDate()),
        ),
        columns: { startsAt: true, endsAt: true },
      }),
      db.query.bookings.findMany({
        where: and(
          eq(schema.bookings.hostId, u.id),
          ne(schema.bookings.status, "cancelled"),
          gte(schema.bookings.startsAt, weekStart.toJSDate()),
          lte(schema.bookings.startsAt, weekStart.plus({ days: 7 }).toJSDate()),
        ),
        columns: { id: true },
      }),
    ]);
    const mins = (rows: { startsAt: Date; endsAt: Date }[]) =>
      rows.reduce((m, r) => m + (r.endsAt.getTime() - r.startsAt.getTime()) / 60_000, 0);
    const round = (n: number) => Math.round((n / 60) * 10) / 10;

    try {
      await sendEmail({
        to: u.email,
        ...weeklyDigest({
          name: u.name ?? "",
          meetings: pastMeetings.length,
          hours: round(mins(pastMeetings)),
          focusHours: round(mins(focusBlocks)),
          upcoming: upcomingRows.length,
          manageUrl: `${base()}/dashboard`,
          unsubscribeUrl: unsubscribeUrl(u.id),
        }),
      });
      sent += 1;
      budget -= 1;
      logger.info("lifecycle email sent", {
        event: "lifecycle_email_sent",
        userId: u.id,
        kind: "weekly_digest",
      });
    } catch (err) {
      logger.error("lifecycle email failed", {
        event: "lifecycle_email_failed",
        userId: u.id,
        kind: "weekly_digest",
        err,
      });
    }
  }
  return sent;
}
