import { BookingError, type CreateBookingInput, createBooking } from "@/lib/booking/create-booking";
import { withApiKey } from "@/lib/server/api-key";
import { env } from "@/lib/server/env";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Hold TTL bounds. Long enough to complete a checkout, short enough that a slot
 * a caller abandons doesn't stay locked for long. */
const DEFAULT_TTL_SECONDS = 300;
const MIN_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 1800;

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
  /** How long to reserve the slot, in seconds (default 5 min, max 30 min). */
  ttlSeconds: z.number().int().min(MIN_TTL_SECONDS).max(MAX_TTL_SECONDS).optional(),
});

/**
 * POST /api/v1/holds - reserve a slot on your own event type for a few minutes
 * without confirming it. Returns a `uid` plus `holdExpiresAt`; confirm it with
 * POST /api/v1/holds/{uid}/confirm or let it lapse. The slot is locked for the
 * lifetime of the hold, so a concurrent booking of the same slot is rejected.
 */
export const POST = withApiKey(async (caller, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid" },
      { status: 400 },
    );
  }

  // Only the caller's own event types can be held via their key.
  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(
      eq(schema.eventTypes.id, parsed.data.eventTypeId),
      eq(schema.eventTypes.ownerId, caller.userId),
    ),
    columns: { id: true, maxAttendees: true },
  });
  if (!eventType) return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  // Group events share one slot, so a single-slot hold is meaningless there -
  // capacity is only ever enforced on confirmed seats. Reject rather than mislead.
  if ((eventType.maxAttendees ?? 1) > 1) {
    return NextResponse.json(
      { error: "Holds aren't supported on group event types." },
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
    hold: { ttlSeconds: parsed.data.ttlSeconds ?? DEFAULT_TTL_SECONDS },
  };

  try {
    const { uid, holdExpiresAt } = await createBooking(input);
    return NextResponse.json(
      {
        uid,
        holdExpiresAt: holdExpiresAt?.toISOString() ?? null,
        url: `${env.APP_URL}/booking/${uid}`,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof BookingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Could not create hold" }, { status: 500 });
  }
});
