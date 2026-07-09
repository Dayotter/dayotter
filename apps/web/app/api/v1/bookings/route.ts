import { withApiKey } from "@/lib/server/api-key";
import { and, desc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const STATUSES = ["pending", "confirmed", "cancelled", "rejected", "no_show", "completed"];

/** GET /api/v1/bookings?status=&limit= — the account's bookings, newest first. */
export const GET = withApiKey(async (caller, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  const where =
    status && STATUSES.includes(status)
      ? and(
          eq(schema.bookings.hostId, caller.userId),
          eq(schema.bookings.status, status as (typeof STATUSES)[number] as never),
        )
      : eq(schema.bookings.hostId, caller.userId);

  const rows = await getDb().query.bookings.findMany({
    where,
    orderBy: [desc(schema.bookings.startsAt)],
    limit,
    columns: {
      uid: true,
      title: true,
      status: true,
      startsAt: true,
      endsAt: true,
      timezone: true,
      eventTypeId: true,
      paymentStatus: true,
    },
    with: { attendees: { columns: { name: true, email: true } } },
  });

  return NextResponse.json({
    bookings: rows.map((b) => ({
      uid: b.uid,
      title: b.title,
      status: b.status,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      timezone: b.timezone,
      eventTypeId: b.eventTypeId,
      paymentStatus: b.paymentStatus,
      attendees: b.attendees,
    })),
  });
});
