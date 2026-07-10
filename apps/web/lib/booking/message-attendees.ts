import { logger } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { bookingMessage, sendEmail } from "@calsync/emails";

export type MessageResult = "ok" | "not_found" | "forbidden";

/**
 * Send a host's message to a booking's attendees (with the manage/reschedule
 * link). Host-only. Used by the AI meeting-reply flow after the host confirms.
 */
export async function messageBookingAttendees(
  uid: string,
  hostUserId: string,
  body: string,
): Promise<MessageResult> {
  const db = getDb();
  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking || booking.status === "cancelled") return "not_found";
  if (booking.hostId !== hostUserId) return "forbidden";

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  await Promise.all(
    booking.attendees.map((a) =>
      sendEmail({
        ...bookingMessage({
          eventTitle: booking.title,
          start: booking.startsAt,
          end: booking.endsAt,
          timezone: a.timezone ?? booking.timezone,
          hostName: booking.host?.name ?? "Your host",
          attendeeName: a.name ?? a.email,
          manageUrl: `${appUrl}/booking/${uid}`,
          body,
        }),
        to: a.email,
      }),
    ),
  );

  logger.info("meeting message sent", { event: "meeting_message_sent", bookingId: booking.id });
  return "ok";
}
