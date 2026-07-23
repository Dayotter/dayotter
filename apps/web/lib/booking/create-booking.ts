import { randomUUID } from "node:crypto";
import { consumeCredit } from "@/lib/packages/credits";
import { logger, roundRobinPick, safeEqual, sha256hex } from "@dayotter/core";
import { and, eq, getDb, gte, inArray, lt, schema, sql } from "@dayotter/db";
import { bookingRequested, newBookingRequest, sendEmail } from "@dayotter/emails";
import { DateTime } from "luxon";
import {
  SLOT_REVALIDATION_WINDOW_MS,
  combineHostSlots,
  eventTypeHostSlots,
  isAllowedDuration,
} from "./availability";
import { BookingError, mapInsertError, validateResponses } from "./booking-logic";
import { finalizeConfirmedBooking } from "./finalize-booking";
import { fanOutBookingLifecycle } from "./lifecycle";

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

  // round-robin - only among hosts genuinely free at the chosen time (reusing
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
  /** Access code, required when the event type is password-protected. */
  accessCode?: string;
  /** Set when the booking was paid via Stripe (created from the payment handler). */
  payment?: {
    paymentIntentId: string;
    amountPaid: number;
    currency: string;
    /** Connected account the charge was routed to (for reverse-transfer refunds). */
    destinationAccountId?: string;
  };
  /** Redeem one prepaid package credit for the attendee instead of charging.
   * Consumed atomically inside the booking transaction (restored on rollback). */
  redeemCredit?: boolean;
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

  // Password-protected event type: require a matching access code before booking.
  if (eventType.accessCodeHash) {
    const supplied = input.accessCode?.trim();
    if (!supplied || !safeEqual(sha256hex(supplied), eventType.accessCodeHash)) {
      throw new BookingError("Enter the correct access code to book.", 403);
    }
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

  // Group event: many bookers share one slot (capacity = maxAttendees). Only
  // meaningful for individual (owner) event types.
  const capacity = eventType.maxAttendees ?? 1;
  const isGroup = capacity > 1 && Boolean(eventType.ownerId);

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

  // Focus protection: when the host caps their daily meetings, we hard-decline a
  // booking that would push the day over the limit (see the guard in the tx below).
  const focusPrefs = await db.query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, host.id),
    columns: { adaptiveAvailability: true, maxMeetingsPerDay: true },
  });

  const uid = randomUUID();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const guests = [
    ...new Set([...(input.guests ?? []).filter((e) => e.includes("@")), ...coHostEmails]),
  ];

  // Recurring meetings: one booking spins up a series of occurrences. Group
  // events are excluded (they share a slot). The occurrences share a
  // recurrenceUid so they can be managed together later.
  const recurringCount = !isGroup ? Math.min(52, Math.max(1, eventType.recurringCount ?? 1)) : 1;
  const isRecurring = recurringCount > 1;
  const recurrenceUid = isRecurring ? randomUUID() : null;

  // Opt-in bookings: the host reviews each request before it's confirmed. The
  // booking is stored `pending` with none of the confirmed side-effects run
  // (no calendar write, meeting link, reminders, or recurring occurrences) - the
  // host approves it later (see `approveBooking`), which finalizes it. Paid /
  // credit bookings skip the hold: payment is the commitment, and holding one
  // would mean refunding on decline. The daily/weekly/focus caps below still
  // count only `confirmed` rows, so a pending request never consumes a cap slot.
  const requiresConfirmation =
    Boolean(eventType.requiresConfirmation) && !input.payment && !input.redeemCredit;
  const initialStatus = requiresConfirmation ? "pending" : "confirmed";

  // Persist booking + attendees atomically. The partial unique index on
  // (hostId, startsAt) guards against a concurrent double-book: a request that
  // wins the availability check but loses the insert raises a 23505 → 409.
  let booking: typeof schema.bookings.$inferSelect;
  try {
    booking = await db.transaction(async (tx) => {
      // Serialize all cap-relevant bookings for this host within the host-local
      // ISO week. The daily/weekly/focus checks below are count-then-insert, and
      // the unique/no-overlap indexes only stop same-slot collisions - so without
      // this lock two bookings on DIFFERENT slots of the same day/week could each
      // read count < limit and both commit, exceeding the cap. Locking on
      // host+week (a superset of host+day) closes that race with minimal
      // contention; different weeks never block each other.
      const capApplies =
        eventType.dailyBookingLimit != null ||
        eventType.weeklyBookingLimit != null ||
        (!isGroup && Boolean(focusPrefs?.adaptiveAvailability));
      if (capApplies) {
        const zone = host.timezone || "UTC";
        const weekKey = DateTime.fromJSDate(start).setZone(zone).startOf("week").toISODate();
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${host.id}:${weekKey}`}))`);
      }

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

      // Focus protection (host-wide cap across all event types). Backstops the
      // availability-level slot hiding for group events / direct API / races, so
      // an overloaded day can't be pushed past the host's daily meeting limit.
      if (!isGroup && focusPrefs?.adaptiveAvailability) {
        const cap = focusPrefs.maxMeetingsPerDay ?? 5;
        const zone = host.timezone || "UTC";
        const day = DateTime.fromJSDate(start).setZone(zone);
        const dayStart = day.startOf("day").toJSDate();
        const nextDay = day.startOf("day").plus({ days: 1 }).toJSDate();
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.hostId, host.id),
              eq(schema.bookings.status, "confirmed"),
              gte(schema.bookings.startsAt, dayStart),
              lt(schema.bookings.startsAt, nextDay),
            ),
          );
        if (count >= cap) {
          throw new BookingError(
            "This day is protected for focus and has reached its meeting limit. Please pick another day.",
            409,
          );
        }
      }

      // Weekly cap: same idea over the host-local ISO week containing the slot.
      if (eventType.weeklyBookingLimit != null) {
        const zone = host.timezone || "UTC";
        const week = DateTime.fromJSDate(start).setZone(zone);
        const weekStart = week.startOf("week").toJSDate();
        const nextWeek = week.startOf("week").plus({ weeks: 1 }).toJSDate();
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.eventTypeId, eventType.id),
              eq(schema.bookings.status, "confirmed"),
              gte(schema.bookings.startsAt, weekStart),
              lt(schema.bookings.startsAt, nextWeek),
            ),
          );
        if (count >= eventType.weeklyBookingLimit) {
          throw new BookingError("This week is fully booked. Please pick another week.", 409);
        }
      }

      // Group event capacity: these bookings share a slot and are exempt from the
      // DB single-slot / no-overlap guards, so enforce the seat limit here. A
      // per-slot advisory lock serializes concurrent bookings on the SAME slot so
      // the count-then-insert can't overbook.
      if (isGroup) {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${eventType.id + start.toISOString()}))`,
        );
        const [{ count } = { count: 0 }] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.bookings)
          .where(
            and(
              eq(schema.bookings.eventTypeId, eventType.id),
              eq(schema.bookings.status, "confirmed"),
              eq(schema.bookings.startsAt, start),
            ),
          );
        if (count >= capacity) {
          throw new BookingError("This time is fully booked. Please pick another slot.", 409);
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

      // Prepaid package: spend one credit atomically as the payment method.
      // Done inside the tx so a lost double-book race rolls the credit back too.
      if (input.redeemCredit) {
        const spent = await consumeCredit(eventType.id, input.attendee.email, tx);
        if (!spent) {
          throw new BookingError("You have no prepaid sessions left for this event.", 402);
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
          status: initialStatus,
          isGroup,
          location: eventType.locationDetail,
          responses: input.responses,
          uid,
          recurrenceUid,
          paymentStatus: input.payment || input.redeemCredit ? "paid" : "none",
          paymentIntentId: input.payment?.paymentIntentId,
          amountPaid: input.payment?.amountPaid,
          paymentCurrency: input.payment?.currency,
          destinationAccountId: input.payment?.destinationAccountId,
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

  // Fan out to webhooks, CRM sync, and plugin hooks (all best-effort).
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
      attendees: [{ name: input.attendee.name, email: input.attendee.email }],
    },
    {
      uid,
      eventTypeId: eventType.id,
      title: eventType.title,
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      status: booking.status,
      attendee: { name: input.attendee.name, email: input.attendee.email },
    },
  );

  // Opt-in bookings stop here: the request is held as `pending` and NONE of the
  // confirmed side-effects run. Tell the attendee it's been requested and the
  // host it needs approval; the rest happens when the host approves it.
  if (requiresConfirmation) {
    const attendeeManageUrl = `${appUrl}/booking/${uid}`;
    const hostReviewUrl = `${appUrl}/bookings`;
    try {
      await sendEmail({
        ...bookingRequested({
          eventTitle: eventType.title,
          start,
          end,
          timezone: input.attendee.timezone,
          hostName: host.name ?? "your host",
          attendeeName: input.attendee.name,
          location: eventType.locationDetail ?? undefined,
          manageUrl: attendeeManageUrl,
        }),
        to: input.attendee.email,
      });
    } catch (err) {
      logger.error("booking request email failed", {
        event: "request_email_failed",
        bookingId: booking.id,
        recipient: "attendee",
        err,
      });
    }
    if (host.email) {
      try {
        await sendEmail({
          ...newBookingRequest({
            eventTitle: eventType.title,
            start,
            end,
            timezone: host.timezone,
            hostName: host.name ?? "you",
            attendeeName: input.attendee.name,
            location: eventType.locationDetail ?? undefined,
            manageUrl: hostReviewUrl,
          }),
          to: host.email,
        });
      } catch (err) {
        logger.error("booking request email failed", {
          event: "request_email_failed",
          bookingId: booking.id,
          recipient: "host",
          err,
        });
      }
    }
    return { uid, redirectUrl: eventType.redirectUrl ?? null };
  }

  // Confirmed immediately: run every confirmed-booking side-effect (meeting link,
  // host calendar, reminders, workflows, travel, confirmation emails, recurring
  // occurrences). Shared verbatim with the host-approval path.
  await finalizeConfirmedBooking({
    booking,
    eventType,
    host,
    attendee: input.attendee,
    guests,
    notes: input.notes,
    appUrl,
  });

  return { uid, redirectUrl: eventType.redirectUrl ?? null };
}
