import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { bookingRescheduled, sendEmail } from "@dayotter/emails";
import { enqueueCrmSync } from "@dayotter/jobs";
import { reserveRuleBlocks } from "../automation/apply-rules";
import { updateBookingCalendarEvent } from "../calendar/host-calendar";
import { emitWebhook } from "../webhooks/emit";
import { SLOT_REVALIDATION_WINDOW_MS, eventConstraints, hostSlots } from "./availability";
import { AUTO_CONFERENCE } from "./event-type-input";
import {
  clearBookingReminders,
  reminderOffsetsForHost,
  scheduleBookingReminders,
  scheduleWorkflowMessages,
} from "./reminders";
import { reserveTravelBlocks } from "./travel";

export class RescheduleError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** Move a booking to a new start time: validate, update, move the calendar event,
 * reschedule reminders, and notify attendees. */
export async function rescheduleBooking(uid: string, newStartISO: string): Promise<void> {
  const db = getDb();

  const booking = await db.query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking || booking.status === "cancelled") {
    throw new RescheduleError("Booking not found", 404);
  }
  const eventType = await db.query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, booking.eventTypeId),
  });
  if (!eventType) throw new RescheduleError("Event type not found", 404);

  const newStart = new Date(newStartISO);
  if (Number.isNaN(newStart.getTime())) throw new RescheduleError("Invalid time", 400);
  const newEnd = new Date(newStart.getTime() + eventType.durationMinutes * 60_000);

  if (newStart.getTime() === booking.startsAt.getTime()) return; // no-op

  // Validate the new slot against the booking's actual host only (not the whole
  // team) - the host is already fixed, so there's no need to fan out.
  const scheduleId = eventType.ownerId === booking.hostId ? eventType.scheduleId : null;
  const slots = await hostSlots(
    booking.hostId,
    scheduleId,
    eventConstraints(eventType),
    new Date(newStart.getTime() - SLOT_REVALIDATION_WINDOW_MS),
    new Date(newStart.getTime() + SLOT_REVALIDATION_WINDOW_MS),
    0,
    booking.id, // don't let the booking being moved block its own new slot
  );
  if (!slots.some((s) => s.start.getTime() === newStart.getTime())) {
    throw new RescheduleError("That time is no longer available", 409);
  }

  await db
    .update(schema.bookings)
    .set({ startsAt: newStart, endsAt: newEnd })
    .where(eq(schema.bookings.id, booking.id));

  // Move the calendar event (best-effort).
  const meetingUrl = await updateBookingCalendarEvent(booking.id, {
    title: booking.title,
    description: booking.description ?? undefined,
    start: newStart,
    end: newEnd,
    timezone: booking.timezone,
    attendees: booking.attendees.map((a) => ({ email: a.email, name: a.name ?? undefined })),
    location: eventType.locationDetail ?? undefined,
    createConference: AUTO_CONFERENCE.includes(eventType.location),
  });
  if (meetingUrl) {
    await db.update(schema.bookings).set({ meetingUrl }).where(eq(schema.bookings.id, booking.id));
  }

  // Replace reminders at the host's preferred lead times.
  await clearBookingReminders(booking.id);
  await scheduleBookingReminders(
    booking.id,
    newStart,
    await reminderOffsetsForHost(booking.hostId),
  );
  // Re-schedule workflow messages against the new time window.
  await scheduleWorkflowMessages(
    booking.id,
    eventType.organizationId,
    eventType.id,
    newStart,
    newEnd,
  );

  // Move the booking's reserved travel / prep / buffer blocks to the new time
  // (else the old ones linger and new ones would double up).
  await db
    .delete(schema.timeBlocks)
    .where(eq(schema.timeBlocks.bookingId, booking.id))
    .catch(() => {});
  await reserveRuleBlocks({
    bookingId: booking.id,
    hostId: booking.hostId,
    title: booking.title,
    startsAt: newStart,
    endsAt: newEnd,
  }).catch(() => {});
  await reserveTravelBlocks({
    hostId: booking.hostId,
    bookingId: booking.id,
    location: eventType.location,
    startsAt: newStart,
    endsAt: newEnd,
    place: eventType.locationDetail,
  });

  logger.info("booking rescheduled", {
    event: "booking_rescheduled",
    bookingId: booking.id,
    uid,
    hostId: booking.hostId,
  });

  if (booking.hostId) {
    await emitWebhook(booking.hostId, "booking.rescheduled", {
      uid,
      eventTypeId: booking.eventTypeId,
      title: booking.title,
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    });
    await enqueueCrmSync({ bookingId: booking.id, action: "rescheduled" }).catch(() => {});
  }

  // Notify.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    await Promise.all(
      [
        ...booking.attendees.map((a) => ({
          email: a.email,
          name: a.name,
          tz: a.timezone ?? booking.timezone,
        })),
        ...(booking.host?.email
          ? [{ email: booking.host.email, name: booking.host.name, tz: booking.host.timezone }]
          : []),
      ].map((r) =>
        sendEmail({
          ...bookingRescheduled({
            eventTitle: booking.title,
            start: newStart,
            end: newEnd,
            timezone: r.tz,
            hostName: booking.host?.name ?? "your host",
            attendeeName: r.name ?? r.email,
            meetingUrl: meetingUrl ?? booking.meetingUrl ?? undefined,
            location: eventType.locationDetail ?? undefined,
            manageUrl: `${appUrl}/booking/${uid}`,
          }),
          to: r.email,
        }),
      ),
    );
  } catch (err) {
    logger.error("reschedule email failed", {
      event: "reschedule_email_failed",
      bookingId: booking.id,
      err,
    });
  }
}
