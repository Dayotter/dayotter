import { eq, getDb, schema } from "@calsync/db";
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
      attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
    },
  });
}
