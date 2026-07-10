import { logger } from "@calsync/core";
import { and, eq, getDb, gte, inArray, lt, schema } from "@calsync/db";
import { DateTime } from "luxon";

/** How far ahead we materialize recurring weekly blocks. */
const HORIZON_DAYS = 14;

/** Parse "HH:MM" → {hour, minute}; null if malformed. */
function parseHM(v: string | null): { hour: number; minute: number } | null {
  if (!v) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Automation Engine — time-based (weekly) triggers. For each enabled `weekly`
 * rule, reserve its recurring window as a `focus` time_block on every matching
 * weekday within the horizon, in the host's timezone. Idempotent: skips any
 * occurrence that already has a block starting at that instant, so it's safe to
 * run on every maintenance tick.
 *
 * Composes the Planning Engine (time_blocks) — the availability engine already
 * treats those as busy, so "every Friday, block the afternoon" just works.
 */
export async function materializeWeeklyBlocks(now = new Date()): Promise<number> {
  const db = getDb();
  const rules = await db.query.automationRules.findMany({
    where: and(
      eq(schema.automationRules.trigger, "weekly"),
      eq(schema.automationRules.enabled, true),
    ),
  });
  if (rules.length === 0) return 0;

  // Resolve each host's timezone in one query.
  const userIds = [...new Set(rules.map((r) => r.userId))];
  const users = await db.query.users.findMany({
    where: inArray(schema.users.id, userIds),
    columns: { id: true, timezone: true },
  });
  const tzById = new Map(users.map((u) => [u.id, u.timezone]));

  let created = 0;
  for (const rule of rules) {
    const start = parseHM(rule.windowStart);
    const end = parseHM(rule.windowEnd);
    if (rule.dayOfWeek == null || !start || !end) continue;

    const tz = tzById.get(rule.userId) || "UTC";
    const today = DateTime.fromJSDate(now).setZone(tz).startOf("day");

    // Existing blocks for this user across the horizon, keyed by start instant,
    // so we never double-insert the same occurrence.
    const horizonEnd = today.plus({ days: HORIZON_DAYS }).toJSDate();
    const existing = await db.query.timeBlocks.findMany({
      where: and(
        eq(schema.timeBlocks.userId, rule.userId),
        gte(schema.timeBlocks.startsAt, today.toJSDate()),
        lt(schema.timeBlocks.startsAt, horizonEnd),
      ),
      columns: { startsAt: true },
    });
    const seen = new Set(existing.map((b) => b.startsAt.getTime()));

    // luxon weekday: 1=Mon..7=Sun. Our dayOfWeek: 0=Sun..6=Sat.
    const targetLuxon = rule.dayOfWeek === 0 ? 7 : rule.dayOfWeek;
    const rows: (typeof schema.timeBlocks.$inferInsert)[] = [];
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const day = today.plus({ days: i });
      if (day.weekday !== targetLuxon) continue;
      const blockStart = day.set({ hour: start.hour, minute: start.minute });
      const blockEnd = day.set({ hour: end.hour, minute: end.minute });
      if (blockEnd <= blockStart) continue;
      const startJs = blockStart.toJSDate();
      if (seen.has(startJs.getTime())) continue;
      rows.push({
        userId: rule.userId,
        title: rule.blockTitle || rule.name || "Blocked",
        kind: "focus",
        startsAt: startJs,
        endsAt: blockEnd.toJSDate(),
      });
    }
    if (rows.length > 0) {
      await db.insert(schema.timeBlocks).values(rows);
      created += rows.length;
    }
  }

  if (created > 0) {
    logger.info("weekly automation blocks materialized", {
      event: "automation_weekly_materialized",
      count: created,
    });
  }
  return created;
}
