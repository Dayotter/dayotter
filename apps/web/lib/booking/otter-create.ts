import { randomUUID } from "node:crypto";
import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { type RecurrenceFreq, seriesOccurrences } from "@/lib/calendar/recurrence";
import { getDb, schema } from "@dayotter/db";
import type { LocationTypeValue } from "./event-type-input";
import { createHostBooking } from "./host-booking";

export interface OtterCreateInput {
  userId: string;
  title: string;
  /** First occurrence. A recurring/batch create expands forward from here. */
  start: Date;
  durationMinutes: number;
  timezone: string;
  notes?: string;
  attendees?: { email: string; name?: string }[];
  eventTypeSlug?: string;
  location?: LocationTypeValue;
  locationDetail?: string;
  /** "focus"/"reminder" become personal holds; anything else a booking. */
  kind?: "meeting" | "focus" | "reminder";
  recurrenceFreq?: RecurrenceFreq;
  recurrenceDays?: number[];
  recurrenceCount?: number;
}

export interface OtterCreateResult {
  /** How many events/holds were actually created (0 = nothing, e.g. no org). */
  count: number;
  /** The first booking's uid/meeting link (meetings only). */
  uid?: string;
  meetingUrl?: string;
}

/**
 * Create an Otter-confirmed event: a single event, a recurring series, or a
 * back-to-back batch. "focus"/"reminder" become personal `time_block`(s) sharing
 * one `seriesId` when recurring; everything else becomes `booking`(s) via
 * `createHostBooking`, sharing one `recurrenceUid` so the whole series can later
 * be cancelled/moved together. Shared by the web/mobile create route and the SMS
 * confirm path so every surface expands a series identically.
 */
export async function createOtterEvent(input: OtterCreateInput): Promise<OtterCreateResult> {
  const occurrences = seriesOccurrences({
    start: input.start,
    durationMinutes: input.durationMinutes,
    freq: input.recurrenceFreq ?? "none",
    daysOfWeek: input.recurrenceDays ?? [],
    count: input.recurrenceCount ?? 1,
    timezone: input.timezone,
  });
  const isSeries = occurrences.length > 1;

  // Personal holds: one time_block per occurrence (shared seriesId when recurring),
  // best-effort mirrored to the calendar - no attendees/invite/reminders.
  if (input.kind === "focus" || input.kind === "reminder") {
    const blockKind = input.kind === "reminder" ? "personal" : "focus";
    const seriesId = isSeries ? randomUUID() : null;
    await getDb()
      .insert(schema.timeBlocks)
      .values(
        occurrences.map((o) => ({
          userId: input.userId,
          title: input.title,
          kind: blockKind,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          seriesId,
        })),
      );
    for (const o of occurrences) {
      await writeBookingToCalendar(input.userId, {
        title: input.title,
        start: o.startsAt,
        end: o.endsAt,
        timezone: input.timezone,
        attendees: [],
      }).catch(() => null);
    }
    return { count: occurrences.length };
  }

  // Meetings: one booking per occurrence, sharing a recurrenceUid.
  const recurrenceUid = isSeries ? randomUUID() : undefined;
  let first: { uid: string; meetingUrl?: string } | undefined;
  let created = 0;
  for (const o of occurrences) {
    const result = await createHostBooking({
      userId: input.userId,
      title: input.title,
      start: o.startsAt,
      end: o.endsAt,
      timezone: input.timezone,
      notes: input.notes,
      attendees: input.attendees,
      eventTypeSlug: input.eventTypeSlug,
      location: input.location,
      locationDetail: input.locationDetail,
      recurrenceUid,
    });
    if (result) {
      created++;
      if (!first) first = result;
    }
  }
  return { count: created, uid: first?.uid, meetingUrl: first?.meetingUrl };
}
