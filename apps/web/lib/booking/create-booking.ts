import { randomUUID } from "node:crypto";
import { logger, roundRobinPick } from "@calsync/core";
import { and, eq, getDb, gte, inArray, lt, schema, sql } from "@calsync/db";
import { bookingConfirmation, sendEmail } from "@calsync/emails";
import { DateTime } from "luxon";
import { applyBookingRules } from "../automation/apply-rules";
import { writeBookingToCalendar } from "../calendar/host-calendar";
import {
  SLOT_REVALIDATION_WINDOW_MS,
  combineHostSlots,
  eventTypeHostSlots,
  isAllowedDuration,
} from "./availability";
import { BookingError, mapInsertError, validateResponses } from "./booking-logic";
import { AUTO_CONFERENCE } from "./event-type-input";
import { reminderOffsetsForHost, scheduleBookingReminders } from "./reminders";
import { reserveTravelBlocks } from "./travel";

export { BookingError } from "./booking-logic";

type EventTypeRow = typeof schema.eventTypes.$inferSelect;
type UserRow = typeof schema.users.$inferSelect;
type Slot = { start: Date; end: Date };

/**
 * Resolve who hosts a booking, reusing the already-computed per-host slots
 * (indexed by the parallel `hostIds`) so we never recompute availability:
 * - individual → the owner
 * - collective → the first host, with the rest invited as co-hosts
 * - round-robin → a fairly-picked host who is actually free at that time
 */
async function resolveHost(
  eventType: EventTypeRow,
  start: Date,
  hostIds: string[],
  perHost: Slot[][],
): Promise<{ host: UserRow; coHostEmails: string[] }> {
  const db = getDb();

  if (eventType.ownerId) {
    const host = await db.query.users.findFirst({ where: eq(schema.users.id, eventType.ownerId) });
    if (!host) throw new BookingError("Host not found", 404);
    return { host, coHostEmails: [] };
  }

  const hosts = await db.query.eventTypeHosts.findMany({
    where: eq(schema.eventTypeHosts.eventTypeId, eventType.id),
    with: { user: true },
  });
  if (hosts.length === 0) throw new BookingError("No hosts configured", 400);

  if (eventType.schedulingType === "collective") {
    const primary = hosts[0];
    if (!primary?.user) throw new BookingError("Host not found", 404);
    const coHostEmails = hosts
      .slice(1)
      .map((h) => h.user?.email)
      .filter((e): e is string => Boolean(e));
    return { host: primary.user, coHostEmails };
  }

  // round-robin — only among hosts genuinely free at the chosen time (reusing
  // the slots we already computed above).
  const slotsByHost = new Map(hostIds.map((id, i) => [id, perHost[i] ?? []]));
  const free = hosts.filter((h) =>
    (slotsByHost.get(h.userId) ?? []).some((s) => s.start.getTime() === start.getTime()),
  );
  if (free.length === 0) throw new BookingError("No host available at that time", 409);

  // One grouped query for all free hosts' current load (was N queries).
  const loads = await db
    .select({ hostId: schema.bookings.hostId, count: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        inArray(
          schema.bookings.hostId,
          free.map((h) => h.userId),
        ),
        eq(schema.bookings.status, "confirmed"),
      ),
    )
    .groupBy(schema.bookings.hostId);
  const loadByHost = new Map(loads.map((l) => [l.hostId, l.count]));

  const picked = roundRobinPick(
    free.map((h) => ({
      userId: h.userId,
      priority: h.priority,
      currentLoad: loadByHost.get(h.userId) ?? 0,
    })),
  );
  const host = free.find((h) => h.userId === picked?.userId)?.user;
  if (!host) throw new BookingError("No host available", 409);
  return { host, coHostEmails: [] };
}

export interface CreateBookingInput {
  eventTypeId: string;
  start: string; // ISO instant of the chosen slot
  attendee: { name: string; email: string; timezone: string };
  guests?: string[];
  notes?: string;
  responses?: Record<string, unknown>;
  /** The booker's chosen duration for multi-duration event types (minutes). */
  durationMinutes?: number;
  /** Single-use booking-link token to consume atomically with the booking. */
  linkToken?: string;
  /** Set when the booking was paid via Stripe (created from the payment handler). */
  payment?: { paymentIntentId: string; amountPaid: number; currency: string };
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ uid: string; redirectUrl: string | null }> {
  const db = getDb();

  const eventType = await db.query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, input.eventTypeId),
  });
  if (!eventType || !eventType.isActive) {
    throw new BookingError("Event type not found", 404);
  }

  validateResponses(eventType.questions, input.responses);

  const start = new Date(input.start);
  if (Number.isNaN(start.getTime())) throw new BookingError("Invalid start time", 400);

  // Multiple durations: honor the booker's chosen length only if the event type
  // allows it; otherwise fall back to the default duration.
  const duration =
    input.durationMinutes && isAllowedDuration(eventType, input.durationMinutes)
      ? input.durationMinutes
      : eventType.durationMinutes;
  const end = new Date(start.getTime() + duration * 60_000);

  // Re-validate server-side (the picker may be stale / manipulated). Compute the
  // per-host slots once (for the chosen duration) and reuse them for the check
  // and host resolution.
  const { hostIds, perHost } = await eventTypeHostSlots(
    eventType,
    new Date(start.getTime() - SLOT_REVALIDATION_WINDOW_MS),
    new Date(start.getTime() + SLOT_REVALIDATION_WINDOW_MS),
    duration,
  );
  const combined = combineHostSlots(perHost, eventType.schedulingType);
  if (!combined.some((s) => s.start.getTime() === start.getTime())) {
    throw new BookingError("That time is no longer available", 409);
  }

  const { host, coHostEmails } = await resolveHost(eventType, start, hostIds, perHost);

  const uid = randomUUID();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const guests = [
    ...new Set([...(input.guests ?? []).filter((e) => e.includes("@")), ...coHostEmails]),
  ];

  // Persist booking + attendees atomically. The partial unique index on
  // (hostId, startsAt) guards against a concurrent double-book: a request that
  // wins the availability check but loses the insert raises a 23505 → 409.
  let booking: typeof schema.bookings.$inferSelect;
  try {
    booking = await db.transaction(async (tx) => {
      // Daily cap: count this event type's confirmed bookings on the same
      // host-local calendar day as the requested slot, inside the transaction so
      // concurrent bookings can't both slip past the limit.
      if (eventType.dailyBookingLimit != null) {
        const zone = host.timezone || "UTC";
        const day = DateTime.fromJSDate(start).setZone(zone);
        const dayStart = day.startOf("day").toJSDate();
        const nextDay = day.startOf("day").plus({ days: 1 }).toJSDate();
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.eventTypeId, eventType.id),
              eq(schema.bookings.status, "confirmed"),
              gte(schema.bookings.startsAt, dayStart),
              lt(schema.bookings.startsAt, nextDay),
            ),
          );
        if (count >= eventType.dailyBookingLimit) {
          throw new BookingError("This day is fully booked. Please pick another day.", 409);
        }
      }

      // Consume a single-use / limited booking link atomically: only succeeds
      // while there are uses left and it hasn't expired.
      if (input.linkToken) {
        const consumed = await tx
          .update(schema.bookingLinks)
          .set({ usedCount: sql`${schema.bookingLinks.usedCount} + 1` })
          .where(
            and(
              eq(schema.bookingLinks.token, input.linkToken),
              eq(schema.bookingLinks.eventTypeId, eventType.id),
              sql`${schema.bookingLinks.usedCount} < ${schema.bookingLinks.maxUses}`,
              sql`(${schema.bookingLinks.expiresAt} IS NULL OR ${schema.bookingLinks.expiresAt} >= CURRENT_DATE)`,
            ),
          )
          .returning({ id: schema.bookingLinks.id });
        if (consumed.length === 0) {
          throw new BookingError("This booking link is no longer valid.", 410);
        }
      }

      const [row] = await tx
        .insert(schema.bookings)
        .values({
          organizationId: eventType.organizationId,
          eventTypeId: eventType.id,
          hostId: host.id,
          title: eventType.title,
          description: input.notes,
          startsAt: start,
          endsAt: end,
          timezone: input.attendee.timezone,
          status: "confirmed",
          location: eventType.locationDetail,
          responses: input.responses,
          uid,
          paymentStatus: input.payment ? "paid" : "none",
          paymentIntentId: input.payment?.paymentIntentId,
          amountPaid: input.payment?.amountPaid,
          paymentCurrency: input.payment?.currency,
        })
        .returning();
      if (!row) throw new BookingError("Failed to create booking", 500);

      await tx.insert(schema.bookingAttendees).values([
        {
          bookingId: row.id,
          name: input.attendee.name,
          email: input.attendee.email,
          timezone: input.attendee.timezone,
        },
        ...guests.map((email) => ({ bookingId: row.id, email })),
      ]);
      return row;
    });
  } catch (err) {
    mapInsertError(err);
  }

  logger.info("booking created", {
    event: "booking_created",
    bookingId: booking.id,
    uid,
    eventTypeId: eventType.id,
    hostId: host.id,
  });

  // Write to the host's calendar (best-effort; booking stands without it).
  let meetingUrl: string | undefined;
  try {
    const written = await writeBookingToCalendar(host.id, {
      title: eventType.title,
      description: input.notes,
      start,
      end,
      timezone: input.attendee.timezone,
      attendees: [
        { email: input.attendee.email, name: input.attendee.name },
        ...guests.map((email) => ({ email })),
      ],
      location: eventType.locationDetail ?? undefined,
      createConference: AUTO_CONFERENCE.includes(eventType.location),
    });
    if (written) {
      meetingUrl = written.meetingUrl;
      await db
        .update(schema.bookings)
        .set({ meetingUrl })
        .where(eq(schema.bookings.id, booking.id));
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

  // Schedule reminders at the host's preferred lead times.
  await scheduleBookingReminders(booking.id, start, await reminderOffsetsForHost(host.id));

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
    location: eventType.location,
    startsAt: start,
    endsAt: end,
    place: eventType.locationDetail,
  });

  // Confirmation emails to attendee + host.
  try {
    const manageUrl = `${appUrl}/booking/${uid}`;
    await sendEmail({
      ...bookingConfirmation({
        eventTitle: eventType.title,
        start,
        end,
        timezone: input.attendee.timezone,
        hostName: host.name ?? "your host",
        attendeeName: input.attendee.name,
        location: eventType.locationDetail ?? undefined,
        meetingUrl,
        manageUrl,
      }),
      to: input.attendee.email,
    });
    if (host.email) {
      await sendEmail({
        ...bookingConfirmation({
          eventTitle: eventType.title,
          start,
          end,
          timezone: host.timezone,
          hostName: host.name ?? "you",
          attendeeName: input.attendee.name,
          location: eventType.locationDetail ?? undefined,
          meetingUrl,
          manageUrl,
        }),
        to: host.email,
      });
    }
  } catch (err) {
    logger.error("confirmation email failed", {
      event: "confirmation_email_failed",
      bookingId: booking.id,
      err,
    });
  }

  return { uid, redirectUrl: eventType.redirectUrl ?? null };
}
