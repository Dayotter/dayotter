import { and, eq, getDb, gte, inArray, lt, schema } from "@dayotter/db";
import { METRICS } from "./metrics";
import type { MetricResult, TimeDataset } from "./types";

export type { MetricResult, StatResult, BreakdownResult, TimeMetric } from "./types";
export { METRICS } from "./metrics";

/** Load the shared dataset (one pass over bookings + focus blocks) for a window. */
async function loadDataset(userId: string, tz: string, windowDays: number): Promise<TimeDataset> {
  const db = getDb();
  const now = new Date();
  const from = new Date(now.getTime() - windowDays * 86_400_000);

  const [bookings, blocks] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        // Past meetings are auto-marked "completed"; a retrospective view needs both.
        inArray(schema.bookings.status, ["confirmed", "completed"]),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, now),
      ),
      columns: { startsAt: true, endsAt: true, title: true },
      with: {
        attendees: { columns: { name: true, email: true } },
        eventType: { columns: { title: true, color: true } },
      },
    }),
    db.query.timeBlocks.findMany({
      where: and(
        eq(schema.timeBlocks.userId, userId),
        eq(schema.timeBlocks.kind, "focus"),
        gte(schema.timeBlocks.startsAt, from),
        lt(schema.timeBlocks.startsAt, now),
      ),
      columns: { startsAt: true, endsAt: true },
    }),
  ]);

  return {
    tz,
    windowDays,
    bookings: bookings.map((b) => ({
      start: b.startsAt,
      end: b.endsAt,
      attendees: b.attendees,
      typeTitle: b.eventType?.title ?? b.title,
      color: b.eventType?.color ?? null,
    })),
    focusBlocks: blocks.map((b) => ({ start: b.startsAt, end: b.endsAt })),
  };
}

/**
 * "Where your time goes" - run every metric over the user's last `windowDays`
 * and return the non-empty cards. Extensible: metrics come from METRICS.
 */
export async function computeTimeAllocation(params: {
  userId: string;
  tz?: string;
  windowDays?: number;
}): Promise<{ windowDays: number; metrics: MetricResult[] }> {
  const windowDays = params.windowDays ?? 30;
  let tz = params.tz;
  if (!tz) {
    const user = await getDb().query.users.findFirst({
      where: eq(schema.users.id, params.userId),
      columns: { timezone: true },
    });
    tz = user?.timezone ?? "UTC";
  }
  const data = await loadDataset(params.userId, tz, windowDays);
  const metrics = METRICS.map((m) => m.compute(data)).filter((r): r is MetricResult => r !== null);
  return { windowDays, metrics };
}
