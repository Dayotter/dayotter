import { randomUUID } from "node:crypto";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { bookingConfirmation, sendEmail } from "@dayotter/emails";
import { DateTime } from "luxon";
import { applyBookingRules } from "../automation/apply-rules";
import { writeBookingToCalendar } from "../calendar/host-calendar";
import { createZoomMeeting } from "../integrations/zoom";
import { AUTO_CONFERENCE } from "./event-type-input";
import { fanOutBookingLifecycle } from "./lifecycle";
import {
  hostWantsOverflowNotice,
  hostWantsScribe,
  reminderOffsetsForHost,
  scheduleBookingReminders,
  scheduleOverflowCheck,
  scheduleScribe,
  scheduleWorkflowMessages,
} from "./reminders";
import { reserveTravelBlocks } from "./travel";

export interface FinalizeContext {
  /** The (now-confirmed) primary booking row. */
  booking: typeof schema.bookings.$inferSelect;
  eventType: typeof schema.eventTypes.$inferSelect;
  host: typeof schema.users.$inferSelect;
  /** The primary attendee (guests are their own list). */
  attendee: { name: string; email: string; timezone: string };
  guests: string[];
  notes?: string | null;
  appUrl: string;
}

/**
 * Run every side-effect that a *confirmed* booking triggers: the Zoom/meeting
 * link, the host-calendar write, reminders, overflow/scribe nudges, workflow
 * messages, automation rules, travel blocks, confirmation emails, and the
 * recurring-series expansion.
 *
 * This is deliberately separate from {@link createBooking} so both code paths
 * that end in a confirmed booking share it verbatim:
 *  - a normal booking (no approval needed), confirmed immediately, and
 *  - a `requiresConfirmation` booking the host later approves (see
 *    `approveBooking`), which was held as `pending` with none of this run yet.
 *
 * Everything here is best-effort - the booking already exists and stands even if
 * an individual step (calendar, email, ...) fails.
 */
export async function finalizeConfirmedBooking(ctx: FinalizeContext): Promise<void> {
  const { booking, eventType, host, attendee, guests, notes, appUrl } = ctx;
  const db = getDb();

  const start = booking.startsAt;
  const end = booking.endsAt;
  const uid = booking.uid;
  const isGroup = booking.isGroup;
  const recurrenceUid = booking.recurrenceUid;
  const duration = Math.round((end.getTime() - start.getTime()) / 60_000);
  const recurringCount = !isGroup ? Math.min(52, Math.max(1, eventType.recurringCount ?? 1)) : 1;
  const isRecurring = recurringCount > 1 && Boolean(recurrenceUid);

  // Fan out to webhooks / CRM sync / plugin hooks (best-effort). This fires HERE,
  // when the booking is actually confirmed - so an opt-in request that's still
  // `pending` (or later declined) never emits a phantom "created", and a request
  // the host approves emits it exactly once, on approval.
  await fanOutBookingLifecycle(
    "created",
    {
      bookingId: booking.id,
      uid,
      hostId: host.id,
      eventTypeId: eventType.id,
      title: eventType.title,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      attendees: [{ name: attendee.name, email: attendee.email }],
    },
    {
      uid,
      eventTypeId: eventType.id,
      title: eventType.title,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status: "confirmed",
      attendee: { name: attendee.name, email: attendee.email },
    },
  );

  // Zoom event types: auto-create a real Zoom meeting when the host has Zoom
  // connected (falls back to any manual link otherwise). Best-effort.
  // Group events share one link (the host's configured location) and are NOT
  // written to the host calendar - a per-booking event would sync back as busy
  // and wrongly close the shared slot, and per-booking Zoom links would differ.
  let zoomUrl: string | null = null;
  if (!isGroup && eventType.location === "zoom") {
    zoomUrl = await createZoomMeeting(host.id, {
      topic: eventType.title,
      startISO: start.toISOString(),
      durationMinutes: duration,
      timezone: attendee.timezone,
    });
  }

  // Write to the host's calendar (best-effort; booking stands without it).
  // Skipped for group events (see above).
  let meetingUrl: string | undefined = zoomUrl ?? undefined;
  try {
    const written = isGroup
      ? null
      : await writeBookingToCalendar(host.id, {
          title: eventType.title,
          description: notes ?? undefined,
          start,
          end,
          timezone: attendee.timezone,
          attendees: [
            { email: attendee.email, name: attendee.name },
            ...guests.map((email) => ({ email })),
          ],
          // Prefer the fresh Zoom link so the calendar invite carries it.
          location: zoomUrl ?? eventType.locationDetail ?? undefined,
          createConference: AUTO_CONFERENCE.includes(eventType.location),
        });
    if (written) {
      // A provider conference (Google Meet / Teams) wins if one was created;
      // otherwise keep the Zoom link.
      meetingUrl = written.meetingUrl ?? meetingUrl;
      await db.insert(schema.bookingReferences).values({
        bookingId: booking.id,
        calendarId: written.calendarId,
        provider: written.provider,
        externalEventId: written.externalEventId,
      });
    }
  } catch (err) {
    logger.error("calendar write failed", {
      event: "calendar_write_failed",
      bookingId: booking.id,
      hostId: host.id,
      err,
    });
  }

  // Persist the resolved meeting URL (Zoom and/or a calendar conference).
  if (meetingUrl) {
    await db.update(schema.bookings).set({ meetingUrl }).where(eq(schema.bookings.id, booking.id));
  }

  // Host opt-ins (computed once; reused for the recurring occurrences below).
  const [wantsOverflow, wantsScribe] = await Promise.all([
    hostWantsOverflowNotice(host.id),
    hostWantsScribe(host.id),
  ]);

  // Schedule reminders at the host's preferred lead times.
  await scheduleBookingReminders(booking.id, start, await reminderOffsetsForHost(host.id));

  // Proactive overflow: if the host opted in, schedule an end-of-meeting check
  // that auto-notifies a back-to-back next meeting when this one runs over.
  if (wantsOverflow) {
    await scheduleOverflowCheck(booking.id, end);
  }

  // Post-meeting recap ("Scribe"): if the host opted in, nudge them just after
  // the meeting ends to capture notes and line up the next step.
  if (wantsScribe) {
    await scheduleScribe(booking.id, end);
  }

  // Schedule the host's workflow messages (custom reminders / follow-ups).
  await scheduleWorkflowMessages(booking.id, eventType.organizationId, eventType.id, start, end);

  // Automation rules (prep blocks / buffers / follow-ups). Best-effort.
  await applyBookingRules({
    bookingId: booking.id,
    hostId: host.id,
    title: eventType.title,
    startsAt: start,
    endsAt: end,
  });

  // Travel-Aware Scheduling: reserve travel time around in-person meetings.
  await reserveTravelBlocks({
    hostId: host.id,
    bookingId: booking.id,
    location: eventType.location,
    startsAt: start,
    endsAt: end,
    place: eventType.locationDetail,
  });

  // Confirmation emails to attendee + host. Send them INDEPENDENTLY: a failure to
  // the host (e.g. a provider that only allows verified recipients in test mode)
  // must not stop the attendee's mail, and each failure is logged with its
  // recipient so the cause is visible instead of a single opaque error.
  const manageUrl = `${appUrl}/booking/${uid}`;
  const sendConfirmation = async (
    to: string,
    timezone: string,
    hostName: string,
    recipient: "attendee" | "host",
  ) => {
    try {
      await sendEmail({
        ...bookingConfirmation({
          eventTitle: eventType.title,
          start,
          end,
          timezone,
          hostName,
          attendeeName: attendee.name,
          location: eventType.locationDetail ?? undefined,
          meetingUrl,
          manageUrl,
        }),
        to,
      });
    } catch (err) {
      logger.error("confirmation email failed", {
        event: "confirmation_email_failed",
        bookingId: booking.id,
        recipient,
        to,
        err,
      });
    }
  };
  await sendConfirmation(attendee.email, attendee.timezone, host.name ?? "your host", "attendee");
  if (host.email) {
    await sendConfirmation(host.email, host.timezone, host.name ?? "you", "host");
  }

  // Recurring series: create the remaining occurrences (best-effort each; an
  // occurrence that collides with an existing booking is skipped). Attendees get
  // one confirmation for the first meeting above - the rest land on the calendar.
  if (isRecurring) {
    const zone = attendee.timezone || host.timezone || "UTC";
    const base = DateTime.fromJSDate(start).setZone(zone);
    const offsets = await reminderOffsetsForHost(host.id);
    const attendeeList = [
      { email: attendee.email, name: attendee.name },
      ...guests.map((email) => ({ email })),
    ];
    for (let i = 1; i < recurringCount; i++) {
      const occStart =
        eventType.recurringFrequency === "monthly"
          ? base.plus({ months: i }).toJSDate()
          : eventType.recurringFrequency === "biweekly"
            ? base.plus({ weeks: 2 * i }).toJSDate()
            : base.plus({ weeks: i }).toJSDate();
      const occEnd = new Date(occStart.getTime() + duration * 60_000);
      try {
        const [occ] = await db
          .insert(schema.bookings)
          .values({
            organizationId: eventType.organizationId,
            eventTypeId: eventType.id,
            hostId: host.id,
            title: eventType.title,
            description: notes,
            startsAt: occStart,
            endsAt: occEnd,
            timezone: attendee.timezone,
            status: "confirmed",
            isGroup: false,
            location: eventType.locationDetail,
            responses: booking.responses,
            uid: randomUUID(),
            recurrenceUid,
          })
          .returning();
        if (!occ) continue;
        await db.insert(schema.bookingAttendees).values([
          {
            bookingId: occ.id,
            name: attendee.name,
            email: attendee.email,
            timezone: attendee.timezone,
          },
          ...guests.map((email) => ({ bookingId: occ.id, email })),
        ]);
        await scheduleBookingReminders(occ.id, occStart, offsets);
        const written = await writeBookingToCalendar(host.id, {
          title: eventType.title,
          description: notes ?? undefined,
          start: occStart,
          end: occEnd,
          timezone: attendee.timezone,
          attendees: attendeeList,
          location: zoomUrl ?? eventType.locationDetail ?? undefined,
          createConference: AUTO_CONFERENCE.includes(eventType.location),
        }).catch(() => null);
        if (written) {
          await db
            .update(schema.bookings)
            .set({ meetingUrl: written.meetingUrl ?? undefined })
            .where(eq(schema.bookings.id, occ.id));
          await db.insert(schema.bookingReferences).values({
            bookingId: occ.id,
            calendarId: written.calendarId,
            provider: written.provider,
            externalEventId: written.externalEventId,
          });
        }

        // Parity with the primary booking: each occurrence must also fan out to
        // webhooks/CRM/plugins and get workflows, overflow, scribe, and travel/
        // rule blocks - otherwise downstream systems only ever see meeting #1.
        const occStartISO = occStart.toISOString();
        const occEndISO = occEnd.toISOString();
        await fanOutBookingLifecycle(
          "created",
          {
            bookingId: occ.id,
            uid: occ.uid,
            hostId: host.id,
            eventTypeId: eventType.id,
            title: eventType.title,
            startsAt: occStartISO,
            endsAt: occEndISO,
            attendees: [{ name: attendee.name, email: attendee.email }],
          },
          {
            uid: occ.uid,
            eventTypeId: eventType.id,
            title: eventType.title,
            startsAt: occStartISO,
            endsAt: occEndISO,
            status: occ.status,
            attendee: { name: attendee.name, email: attendee.email },
          },
        ).catch(() => {});
        await scheduleWorkflowMessages(
          occ.id,
          eventType.organizationId,
          eventType.id,
          occStart,
          occEnd,
        ).catch(() => {});
        if (wantsOverflow) await scheduleOverflowCheck(occ.id, occEnd).catch(() => {});
        if (wantsScribe) await scheduleScribe(occ.id, occEnd).catch(() => {});
        await applyBookingRules({
          bookingId: occ.id,
          hostId: host.id,
          title: eventType.title,
          startsAt: occStart,
          endsAt: occEnd,
        }).catch(() => {});
        await reserveTravelBlocks({
          hostId: host.id,
          bookingId: occ.id,
          location: eventType.location,
          startsAt: occStart,
          endsAt: occEnd,
          place: eventType.locationDetail,
        }).catch(() => {});
      } catch (err) {
        logger.error("recurring occurrence skipped", {
          event: "recurrence_skipped",
          index: i,
          err,
        });
      }
    }
  }
}
