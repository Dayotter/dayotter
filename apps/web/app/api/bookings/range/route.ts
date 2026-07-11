import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, lt, ne, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Bookings for the host within [start, end) — powers the calendar views.
 * Cancelled bookings are excluded. Colour comes from the event type.
 */
export const GET = withUser(async (u, request) => {
  const url = new URL(request.url);
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return jsonError("Invalid range", 400);
  }
  // Guard against unbounded ranges (max ~100 days).
  if (end.getTime() - start.getTime() > 100 * 24 * 60 * 60_000) {
    return jsonError("Range too large", 400);
  }

  const rows = await getDb().query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, u.id),
      ne(schema.bookings.status, "cancelled"),
      gte(schema.bookings.startsAt, start),
      lt(schema.bookings.startsAt, end),
    ),
    orderBy: asc(schema.bookings.startsAt),
    with: {
      attendees: { columns: { name: true, email: true } },
      eventType: { columns: { color: true } },
    },
  });

  return NextResponse.json({
    bookings: rows.map((b) => ({
      uid: b.uid,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      status: b.status,
      color: b.eventType?.color ?? null,
      attendees: b.attendees.map((a) => a.name ?? a.email),
    })),
  });
});
