import { and, eq, getDb, gte, inArray, lt, schema } from "@dayotter/db";
import { METRICS } from "./metrics";
import type { MetricResult, TimeDataset } from "./types";

export type { MetricResult, StatResult, BreakdownResult, TimeMetric } from "./types";
export { METRICS } from "./metrics";

/** Extract a lowercase email domain, or null for a missing/malformed address. */
function emailDomain(email: string | null | undefined): string | null {
  const at = email?.lastIndexOf("@") ?? -1;
  if (!email || at < 0) return null;
  const domain = email
    .slice(at + 1)
    .toLowerCase()
    .trim();
  return domain || null;
}

/** Load the shared dataset (one pass over bookings + focus blocks) for a window. */
async function loadDataset(
  userId: string,
  tz: string,
  windowDays: number,
  hostDomain: string | null,
): Promise<TimeDataset> {
  const db = getDb();
  const now = new Date();
  // A rolling window centred on now: recent history AND what's already booked
  // ahead. A retrospective-only view reads as empty for anyone whose meetings
  // are still upcoming, which is most people most of the time.
  const from = new Date(now.getTime() - windowDays * 86_400_000);
  const to = new Date(now.getTime() + windowDays * 86_400_000);

  const [bookings, blocks] = await Promise.all([
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        // Past meetings are auto-marked "completed"; upcoming ones are "confirmed".
        inArray(schema.bookings.status, ["confirmed", "completed"]),
        gte(schema.bookings.startsAt, from),
        lt(schema.bookings.startsAt, to),
      ),
      columns: { startsAt: true, endsAt: true, title: true, recurrenceUid: true },
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
        lt(schema.timeBlocks.startsAt, to),
      ),
      columns: { startsAt: true, endsAt: true, source: true },
    }),
  ]);

  return {
    tz,
    windowDays,
    spanDays: windowDays * 2,
    hostDomain,
    bookings: bookings.map((b) => ({
      start: b.startsAt,
      end: b.endsAt,
      attendees: b.attendees,
      typeTitle: b.eventType?.title ?? b.title,
      color: b.eventType?.color ?? null,
      isRecurring: b.recurrenceUid !== null,
    })),
    focusBlocks: blocks.map((b) => ({
      start: b.startsAt,
      end: b.endsAt,
      reclaimed: b.source === "reclaimed",
    })),
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
  // Always look up the host (email domain drives external/internal; timezone as
  // a fallback when the caller didn't pass one).
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, params.userId),
    columns: { timezone: true, email: true },
  });
  const tz = params.tz ?? user?.timezone ?? "UTC";
  const hostDomain = emailDomain(user?.email);
  const data = await loadDataset(params.userId, tz, windowDays, hostDomain);
  const metrics = METRICS.map((m) => m.compute(data)).filter((r): r is MetricResult => r !== null);
  return { windowDays, metrics };
}
