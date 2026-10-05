import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** A single booking by its public uid (used by the confirmation/detail views). */
export async function GET(_request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { host: true, attendees: true, eventType: { columns: { questions: true } } },
  });
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Map the booker's intake answers against the event type's questions, keeping
  // only the ones actually answered. Same data the public /booking/[uid] manage
  // page already shows to anyone holding the uid, so returning it here (for the
  // mobile host view) discloses nothing new.
  const responseValues = (booking.responses ?? {}) as Record<string, unknown>;
  const responses = (booking.eventType?.questions ?? [])
    .map((q) => ({ label: q.label, value: responseValues[q.id] ?? null }))
    .filter((r) => r.value !== null && r.value !== undefined && r.value !== "");

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
      // Payment state (null/"none" for free events) so the host can see whether a
      // paid booking was paid or refunded before acting on it.
      paymentStatus: booking.paymentStatus,
      amountPaid: booking.amountPaid,
      paymentCurrency: booking.paymentCurrency,
      // Why it was last cancelled / moved, shown on the detail view.
      cancelReason: booking.cancelReason,
      rescheduleReason: booking.rescheduleReason,
      // The booker's answers to the event type's intake questions (label + value).
      responses,
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
