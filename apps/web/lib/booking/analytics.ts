import { and, eq, getDb, gte, inArray, lt, schema, sql } from "@calsync/db";

export interface FunnelRow {
  eventTypeId: string;
  title: string;
  slug: string;
  color: string | null;
  /** Total page views (top of funnel). */
  views: number;
  /** Distinct visitors (deduped by client id). */
  uniqueVisitors: number;
  /** Bookings created in the window, any status. */
  bookings: number;
  /** Bookings that went through (confirmed + completed + no_show). */
  confirmed: number;
  completed: number;
  /** Cancelled + rejected. */
  cancelled: number;
  noShow: number;
  revenueCents: number;
  currency: string | null;
  /** confirmed / uniqueVisitors, clamped to [0,1]; 0 when no visitors. */
  conversionRate: number;
}

export interface AnalyticsData {
  from: string;
  to: string;
  totals: {
    views: number;
    uniqueVisitors: number;
    bookings: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    noShow: number;
    revenueCents: number;
    conversionRate: number;
  };
  currency: string | null;
  byEventType: FunnelRow[];
}

/** Bookings in these statuses "went through" for funnel purposes. */
const WENT_THROUGH = ["confirmed", "completed", "no_show"] as const;

function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, numerator / denominator);
}

/**
 * Booking-funnel analytics for a host over a window: page views → unique
 * visitors → bookings → confirmed, plus cancellations, no-shows, and revenue,
 * per event type and in total. Bookings are counted by creation time so they
 * line up with the views that drove them.
 */
export async function computeAnalytics(params: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<AnalyticsData> {
  const db = getDb();
  const { from, to } = params;

  const types = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.ownerId, params.userId),
    columns: { id: true, title: true, slug: true, color: true, currency: true },
  });

  const empty: AnalyticsData = {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      views: 0,
      uniqueVisitors: 0,
      bookings: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
      noShow: 0,
      revenueCents: 0,
      conversionRate: 0,
    },
    currency: null,
    byEventType: [],
  };
  if (types.length === 0) return empty;

  const ids = types.map((t) => t.id);

  const viewRows = await db
    .select({
      eventTypeId: schema.bookingPageViews.eventTypeId,
      views: sql<number>`count(*)::int`,
      unique: sql<number>`count(distinct ${schema.bookingPageViews.visitorId})::int`,
    })
    .from(schema.bookingPageViews)
    .where(
      and(
        inArray(schema.bookingPageViews.eventTypeId, ids),
        gte(schema.bookingPageViews.viewedAt, from),
        lt(schema.bookingPageViews.viewedAt, to),
      ),
    )
    .groupBy(schema.bookingPageViews.eventTypeId);

  const bookingRows = await db
    .select({
      eventTypeId: schema.bookings.eventTypeId,
      status: schema.bookings.status,
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(case when ${schema.bookings.paymentStatus} = 'paid' then ${schema.bookings.amountPaid} else 0 end), 0)::int`,
    })
    .from(schema.bookings)
    .where(
      and(
        inArray(schema.bookings.eventTypeId, ids),
        gte(schema.bookings.createdAt, from),
        lt(schema.bookings.createdAt, to),
      ),
    )
    .groupBy(schema.bookings.eventTypeId, schema.bookings.status);

  const viewByType = new Map(viewRows.map((r) => [r.eventTypeId, r]));

  const byEventType: FunnelRow[] = types.map((t) => {
    const v = viewByType.get(t.id);
    const rows = bookingRows.filter((r) => r.eventTypeId === t.id);
    const countFor = (statuses: readonly string[]) =>
      rows.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r.count, 0);

    const uniqueVisitors = v?.unique ?? 0;
    const confirmed = countFor(WENT_THROUGH);
    const revenueCents = rows.reduce((s, r) => s + r.revenue, 0);

    return {
      eventTypeId: t.id,
      title: t.title,
      slug: t.slug,
      color: t.color,
      views: v?.views ?? 0,
      uniqueVisitors,
      bookings: rows.reduce((s, r) => s + r.count, 0),
      confirmed,
      completed: countFor(["completed"]),
      cancelled: countFor(["cancelled", "rejected"]),
      noShow: countFor(["no_show"]),
      revenueCents,
      currency: t.currency,
      conversionRate: rate(confirmed, uniqueVisitors),
    };
  });

  // Sort by activity (views + bookings) so the busiest events lead.
  byEventType.sort((a, b) => b.views + b.bookings - (a.views + a.bookings));

  const sum = (k: keyof FunnelRow) =>
    byEventType.reduce((s, r) => s + (r[k] as number), 0);
  const totalConfirmed = sum("confirmed");
  const totalUnique = sum("uniqueVisitors");

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    totals: {
      views: sum("views"),
      uniqueVisitors: totalUnique,
      bookings: sum("bookings"),
      confirmed: totalConfirmed,
      completed: sum("completed"),
      cancelled: sum("cancelled"),
      noShow: sum("noShow"),
      revenueCents: sum("revenueCents"),
      conversionRate: rate(totalConfirmed, totalUnique),
    },
    currency: byEventType.find((r) => r.revenueCents > 0)?.currency ?? null,
    byEventType,
  };
}
