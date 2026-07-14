import { randomUUID } from "node:crypto";
import { primaryOrg } from "@/lib/billing/entitlements";
import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { PERSONAL_EVENT_TYPE_SLUG } from "./personal-event-type";
import {
  hostWantsOverflowNotice,
  hostWantsScribe,
  reminderOffsetsForHost,
  scheduleBookingReminders,
  scheduleOverflowCheck,
  scheduleScribe,
} from "./reminders";

const PERSONAL_SLUG = PERSONAL_EVENT_TYPE_SLUG;

async function getOrCreatePersonalEventType(
  userId: string,
  organizationId: string,
): Promise<string> {
  const db = getDb();
  const existing = await db.query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.ownerId, userId), eq(schema.eventTypes.slug, PERSONAL_SLUG)),
    columns: { id: true },
  });
  if (existing) return existing.id;
  const [row] = await db
    .insert(schema.eventTypes)
    .values({
      organizationId,
      ownerId: userId,
      slug: PERSONAL_SLUG,
      title: "Personal",
      durationMinutes: 30,
      isPrivate: true,
      isActive: false,
    })
    .returning({ id: schema.eventTypes.id });
  return row!.id;
}

export interface HostBookingInput {
  userId: string;
  title: string;
  start: Date;
  end: Date;
  timezone: string;
  notes?: string;
  attendees?: { email: string; name?: string }[];
  /** Slug of a real event type this maps to (so its workflows apply); else the
   * hidden Personal type. */
  eventTypeSlug?: string;
}

export interface HostBookingResult {
  uid: string;
  meetingUrl?: string;
}

/**
 * Create a real DayOtter booking on behalf of the host — the path Otter's
 * "book / hold" confirmations run through (and any future manual "add event").
 * Unlike a public booking it skips availability gating (the host is
 * deliberately blocking their own time) but it gets the full treatment: a
 * `bookings` row (so it shows in the app), a best-effort calendar write, and
 * reminders/overflow/scribe. Returns null only if the host has no organization.
 */
export async function createHostBooking(
  input: HostBookingInput,
): Promise<HostBookingResult | null> {
  const db = getDb();
  const org = await primaryOrg(input.userId);
  if (!org) return null;

  // Resolve the event type: a real matched one (so its workflows apply), else a
  // hidden per-user Personal type.
  let eventTypeId: string | null = null;
  if (input.eventTypeSlug && input.eventTypeSlug !== PERSONAL_SLUG) {
    const et = await db.query.eventTypes.findFirst({
      where: and(
        eq(schema.eventTypes.ownerId, input.userId),
        eq(schema.eventTypes.slug, input.eventTypeSlug),
      ),
      columns: { id: true },
    });
    eventTypeId = et?.id ?? null;
  }
  if (!eventTypeId) eventTypeId = await getOrCreatePersonalEventType(input.userId, org.id);

  const uid = randomUUID();
  const [booking] = await db
    .insert(schema.bookings)
    .values({
      organizationId: org.id,
      eventTypeId,
      hostId: input.userId,
      title: input.title,
      description: input.notes,
      startsAt: input.start,
      endsAt: input.end,
      timezone: input.timezone,
      status: "confirmed",
      uid,
    })
    .returning();
  if (!booking) return null;

  const attendees = (input.attendees ?? []).filter((a) => a.email.includes("@"));
  if (attendees.length > 0) {
    await db.insert(schema.bookingAttendees).values(
      attendees.map((a) => ({
        bookingId: booking.id,
        email: a.email,
        name: a.name ?? null,
        timezone: input.timezone,
      })),
    );
  }

  // Calendar write (best-effort) + record the reference for later move/delete.
  let meetingUrl: string | undefined;
  try {
    const written = await writeBookingToCalendar(input.userId, {
      title: input.title,
      description: input.notes,
      start: input.start,
      end: input.end,
      timezone: input.timezone,
      attendees: attendees.map((a) => ({ email: a.email, name: a.name })),
    });
    if (written) {
      meetingUrl = written.meetingUrl;
      if (meetingUrl) {
        await db
          .update(schema.bookings)
          .set({ meetingUrl })
          .where(eq(schema.bookings.id, booking.id));
      }
      await db.insert(schema.bookingReferences).values({
        bookingId: booking.id,
        calendarId: written.calendarId,
        provider: written.provider,
        externalEventId: written.externalEventId,
      });
    }
  } catch (err) {
    logger.error("host booking calendar write failed", {
      event: "host_booking_calendar_failed",
      bookingId: booking.id,
      err,
    });
  }

  // Full lifecycle: reminders, plus overflow / scribe when opted in.
  await scheduleBookingReminders(
    booking.id,
    input.start,
    await reminderOffsetsForHost(input.userId),
  );
  if (await hostWantsOverflowNotice(input.userId)) {
    await scheduleOverflowCheck(booking.id, input.end);
  }
  if (await hostWantsScribe(input.userId)) {
    await scheduleScribe(booking.id, input.end);
  }

  return { uid, meetingUrl };
}
