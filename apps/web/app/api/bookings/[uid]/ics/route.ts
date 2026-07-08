import { buildIcs } from "@/lib/booking/ics";
import { eq, getDb, schema } from "@calsync/db";

export const dynamic = "force-dynamic";

/**
 * Downloadable .ics for a booking. Public by the same capability-token model as
 * the rest of the booking flow — the unguessable `uid` from the email link is
 * the credential (attendees have no accounts).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
  });
  if (!booking) return new Response("Not found", { status: 404 });

  const ics = buildIcs({
    uid: booking.uid,
    title: booking.title,
    description: booking.description,
    start: booking.startsAt,
    end: booking.endsAt,
    location: booking.location,
    meetingUrl: booking.meetingUrl,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="booking.ics"',
    },
  });
}
