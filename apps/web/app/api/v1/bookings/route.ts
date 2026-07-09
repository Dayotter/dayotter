import { BookingError, type CreateBookingInput, createBooking } from "@/lib/booking/create-booking";
import { withApiKey } from "@/lib/server/api-key";
import { and, desc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

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

const body = z.object({
  eventTypeId: z.string().uuid(),
  start: z.string().datetime(),
  attendee: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email(),
    timezone: z.string().min(1).max(100),
  }),
  guests: z.array(z.string().email()).max(20).optional(),
  notes: z.string().max(2000).optional(),
  durationMinutes: z.number().int().min(5).max(1440).optional(),
});

/** POST /api/v1/bookings — create a booking programmatically on your own event type. */
export const POST = withApiKey(async (caller, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }

  // Only the caller's own event types can be booked via their key.
  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.id, parsed.data.eventTypeId),
      eq(schema.eventTypes.ownerId, caller.userId),
    ),
    columns: { id: true, price: true },
  });
  if (!eventType) return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  if (eventType.price && eventType.price > 0) {
    return NextResponse.json(
      { error: "Paid event types must be booked through the public page." },
      { status: 400 },
    );
  }

  const input: CreateBookingInput = {
    eventTypeId: parsed.data.eventTypeId,
    start: parsed.data.start,
    attendee: parsed.data.attendee,
    guests: parsed.data.guests,
    notes: parsed.data.notes,
    durationMinutes: parsed.data.durationMinutes,
  };

  try {
    const { uid } = await createBooking(input);
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    return NextResponse.json({ uid, url: `${appUrl}/booking/${uid}` }, { status: 201 });
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not create booking" }, { status: 500 });
  }
});
