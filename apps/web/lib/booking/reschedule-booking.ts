import { logger } from "@dayotter/core";
import { and, eq, getDb, gte, lt, ne, schema, sql } from "@dayotter/db";
import { bookingRescheduled, sendEmail } from "@dayotter/emails";
import { DateTime } from "luxon";
import { reserveRuleBlocks } from "../automation/apply-rules";
import { updateBookingCalendarEvent } from "../calendar/host-calendar";
import { SLOT_REVALIDATION_WINDOW_MS, eventConstraints, hostSlots } from "./availability";
import { AUTO_CONFERENCE } from "./event-type-input";
import { fanOutBookingLifecycle } from "./lifecycle";
import {
  clearBookingReminders,
  hostWantsOverflowNotice,
  hostWantsScribe,
  reminderOffsetsForHost,
  scheduleBookingReminders,
  scheduleOverflowCheck,
  scheduleScribe,
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
export async function rescheduleBooking(
  uid: string,
  newStartISO: string,
  reason?: string,
): Promise<void> {
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
  // Preserve the booking's ACTUAL length (multi-duration event types), not the
  // event type's default - otherwise a 15-min booking silently becomes 30.
  const durationMs = booking.endsAt.getTime() - booking.startsAt.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  if (newStart.getTime() === booking.startsAt.getTime()) return; // no-op

  // Validate the new slot against the booking's actual host only (not the whole
  // team) - the host is already fixed, so there's no need to fan out. Validate at
  // the booking's real duration, too.
  const scheduleId = eventType.ownerId === booking.hostId ? eventType.scheduleId : null;
  const constraints = {
    ...eventConstraints(eventType),
    durationMinutes: Math.round(durationMs / 60_000),
  };
  const slots = await hostSlots(
    booking.hostId,
    scheduleId,
    constraints,
    new Date(newStart.getTime() - SLOT_REVALIDATION_WINDOW_MS),
    new Date(newStart.getTime() + SLOT_REVALIDATION_WINDOW_MS),
    0,
    booking.id, // don't let the booking being moved block its own new slot
  );
  if (!slots.some((s) => s.start.getTime() === newStart.getTime())) {
    throw new RescheduleError("That time is no longer available", 409);
  }

  // Focus cap: don't let a reschedule move a booking INTO an already-capped day.
  const focusPrefs =
    !booking.isGroup && booking.hostId
      ? await db.query.userPreferences.findFirst({
          where: eq(schema.userPreferences.userId, booking.hostId),
          columns: { adaptiveAvailability: true, maxMeetingsPerDay: true },
        })
      : null;
  const zone = booking.host?.timezone || "UTC";
  const targetDay = DateTime.fromJSDate(newStart).setZone(zone);
  const dayStart = targetDay.startOf("day").toJSDate();
  const nextDay = targetDay.startOf("day").plus({ days: 1 }).toJSDate();
  const weekStartD = targetDay.startOf("week");

  // Cap checks + the move run in one transaction, serialized on host+week so a
  // concurrent booking can't slip the day/week cap (mirrors createBooking). A
  // same-slot collision (23505/23P01) maps to a clean 409 instead of a 500.
  try {
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${booking.hostId}:${weekStartD.toISODate()}`}))`,
      );

      const countOnDay = async (byEventType: boolean) => {
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              byEventType
                ? eq(schema.bookings.eventTypeId, eventType.id)
                : eq(schema.bookings.hostId, booking.hostId),
              eq(schema.bookings.status, "confirmed"),
              ne(schema.bookings.id, booking.id),
              gte(schema.bookings.startsAt, dayStart),
              lt(schema.bookings.startsAt, nextDay),
            ),
          );
        return count;
      };

      if (eventType.dailyBookingLimit != null) {
        if ((await countOnDay(true)) >= eventType.dailyBookingLimit) {
          throw new RescheduleError("That day is fully booked. Please pick another day.", 409);
        }
      }
      if (focusPrefs?.adaptiveAvailability) {
        if ((await countOnDay(false)) >= (focusPrefs.maxMeetingsPerDay ?? 5)) {
          throw new RescheduleError(
            "That day is protected for focus and has reached its meeting limit.",
            409,
          );
        }
      }
      if (eventType.weeklyBookingLimit != null) {
        const weekStart = weekStartD.toJSDate();
        const nextWeek = weekStartD.plus({ weeks: 1 }).toJSDate();
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.eventTypeId, eventType.id),
              eq(schema.bookings.status, "confirmed"),
              ne(schema.bookings.id, booking.id),
              gte(schema.bookings.startsAt, weekStart),
              lt(schema.bookings.startsAt, nextWeek),
            ),
          );
        if (count >= eventType.weeklyBookingLimit) {
          throw new RescheduleError("That week is fully booked. Please pick another week.", 409);
        }
      }

      await tx
        .update(schema.bookings)
        .set({ startsAt: newStart, endsAt: newEnd, rescheduleReason: reason ?? null })
        .where(eq(schema.bookings.id, booking.id));
    });
  } catch (err) {
    if (err instanceof RescheduleError) throw err;
    const code = (err as { code?: string })?.code;
    if (code === "23505" || code === "23P01") {
      throw new RescheduleError("That time was just booked", 409);
    }
    throw err;
  }

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
  // clearBookingReminders wiped the overflow + scribe jobs too - re-add them at
  // the new end time under the host's same opt-in, else the host silently loses
  // the "running late" notice and post-meeting recap for a moved booking.
  if (booking.hostId) {
    if (await hostWantsOverflowNotice(booking.hostId)) {
      await scheduleOverflowCheck(booking.id, newEnd);
    }
    if (await hostWantsScribe(booking.hostId)) {
      await scheduleScribe(booking.id, newEnd);
    }
  }

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
    const startsAt = newStart.toISOString();
    const endsAt = newEnd.toISOString();
    await fanOutBookingLifecycle(
      "rescheduled",
      {
        bookingId: booking.id,
        uid,
        hostId: booking.hostId,
        eventTypeId: booking.eventTypeId,
        title: booking.title,
        startsAt,
        endsAt,
        attendees: booking.attendees.map((a) => ({ name: a.name, email: a.email })),
      },
      { uid, eventTypeId: booking.eventTypeId, title: booking.title, startsAt, endsAt },
    );
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
            reason: reason ?? null,
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
