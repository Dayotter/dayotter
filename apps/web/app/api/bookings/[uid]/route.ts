import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** A single booking by its public uid (used by the confirmation/detail views). */
export async function GET(_request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { host: true, attendees: true },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    booking: {
      uid: booking.uid,
      eventTypeId: booking.eventTypeId,
      title: booking.title,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      timezone: booking.timezone,
      status: booking.status,
      meetingUrl: booking.meetingUrl,
      hostName: booking.host?.name ?? null,
      // Part of a recurring series - lets clients offer "cancel this and later".
      isRecurring: Boolean(booking.recurrenceUid),
      // This endpoint is reachable by anyone holding the (unguessable) uid, so
      // don't disclose every co-attendee's email. Only the primary attendee's
      // email is returned (they're the confirmation recipient); guests get names.
      attendees: booking.attendees.map((a, i) => ({
        name: a.name,
        email: i === 0 ? a.email : null,
      })),
    },
  });
}
