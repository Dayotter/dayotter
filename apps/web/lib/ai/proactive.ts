import { deepWorkSuggestions } from "@/lib/booking/focus-suggestions";
import { type Locale, resolveLocale } from "@/lib/i18n";
import { tOtter } from "@/lib/i18n/otter";
import { and, asc, eq, getDb, gte, lt, schema } from "@dayotter/db";
import { DateTime } from "luxon";

/**
 * Proactive Otter - the assistant noticing things worth doing, unprompted, and
 * proposing them confirm-first. Everything here only READS; the surface (the
 * dashboard card + /api/otter/suggestions) executes on the user's explicit OK.
 */

export type ProactiveSuggestion =
  | {
      id: string;
      type: "focus";
      title: string;
      detail: string;
      /** Payload for the "protect" action. */
      startISO: string;
      durationMinutes: number;
    }
  | { id: string; type: "enable_overflow"; title: string; detail: string }
  | { id: string; type: "enable_briefing"; title: string; detail: string };

/** The user's confirmed meetings over the next week (shared across checks). */
async function upcomingWeek(userId: string): Promise<{ startsAt: Date; endsAt: Date }[]> {
  const now = new Date();
  const weekOut = new Date(now.getTime() + 7 * 86_400_000);
  return getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, userId),
      eq(schema.bookings.status, "confirmed"),
      gte(schema.bookings.startsAt, now),
      lt(schema.bookings.startsAt, weekOut),
    ),
    orderBy: asc(schema.bookings.startsAt),
    columns: { startsAt: true, endsAt: true },
  });
}

/** Does the week contain a tight, back-to-back pair (a running-late risk)? */
function hasBackToBack(rows: { startsAt: Date; endsAt: Date }[]): boolean {
  for (let i = 0; i < rows.length - 1; i++) {
    const gapMin = (rows[i + 1]!.startsAt.getTime() - rows[i]!.endsAt.getTime()) / 60_000;
    if (gapMin >= 0 && gapMin <= 5) return true;
  }
  return false;
}

const FOCUS_BLOCK_MINUTES = 90;

/**
 * Compute the proactive nudges to show a user right now. Capped and ordered so
 * the surface stays calm - a couple of high-value proposals, not a firehose.
 */
export async function getProactiveSuggestions(
  userId: string,
  localeInput?: string | null,
): Promise<ProactiveSuggestion[]> {
  const locale: Locale = resolveLocale(localeInput);
  const db = getDb();
  const [user, prefs, upcoming] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { timezone: true } }),
    db.query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
      columns: { overflowNotifyEnabled: true, briefingEnabled: true },
    }),
    upcomingWeek(userId),
  ]);
  const tz = user?.timezone ?? "UTC";
  const out: ProactiveSuggestion[] = [];

  // 1. Open deep-work windows worth protecting (top 2).
  const focus = await deepWorkSuggestions(userId, { days: 5, blockMinutes: FOCUS_BLOCK_MINUTES });
  for (const s of focus.slice(0, 2)) {
    const start = DateTime.fromISO(s.startISO).setZone(tz).setLocale(locale);
    const end = DateTime.fromISO(s.endISO).setZone(tz).setLocale(locale);
    out.push({
      id: `focus:${s.startISO}`,
      type: "focus",
      title: tOtter(locale, "protectDeepWork"),
      detail: tOtter(locale, "focusOpen", {
        day: start.toFormat("cccc"),
        range: `${start.toFormat("h:mm")}–${end.toFormat("h:mm a")}`,
      }),
      startISO: s.startISO,
      durationMinutes: Math.round(end.diff(start, "minutes").minutes),
    });
  }

  // 2. Back-to-back meetings but running-late alerts are off.
  if (!prefs?.overflowNotifyEnabled && hasBackToBack(upcoming)) {
    out.push({
      id: "enable_overflow",
      type: "enable_overflow",
      title: tOtter(locale, "turnOnOverflow"),
      detail: tOtter(locale, "overflowDetail"),
    });
  }

  // 3. No morning briefing yet - only worth it once there's a day to brief.
  if (!prefs?.briefingEnabled && upcoming.length > 0) {
    out.push({
      id: "enable_briefing",
      type: "enable_briefing",
      title: tOtter(locale, "startBriefing"),
      detail: tOtter(locale, "briefingDetail"),
    });
  }

  return out;
}
