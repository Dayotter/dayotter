import type { NewCalendarEvent } from "@calsync/calendar";
import { and, eq, getDb, schema } from "@calsync/db";
import { adapterForConnection } from "@calsync/integrations";

/** The calendar new bookings should be written to for a host, if any. */
async function targetCalendar(userId: string) {
  const db = getDb();
  const connections = await db.query.calendarConnections.findMany({
    where: and(
      eq(schema.calendarConnections.userId, userId),
      eq(schema.calendarConnections.status, "active"),
    ),
    with: { calendars: true },
  });
  for (const conn of connections) {
    // Never write to a read-only source (e.g. an ICS feed) — pick a writable
    // calendar: the chosen booking target if set, else the first writable one.
    const cal =
      conn.calendars.find((c) => c.isTargetForBookings && !c.isReadOnly) ??
      conn.calendars.find((c) => !c.isReadOnly);
    if (cal) return { connection: conn, calendar: cal };
  }
  return null;
}

export interface WrittenEvent {
  calendarId: string;
  provider: "google" | "microsoft" | "apple" | "ics";
  externalEventId: string;
  meetingUrl?: string;
}

/**
 * Best-effort: write a booking to the host's target calendar. Returns null if
 * the host has no connected calendar (the booking still succeeds without it).
 */
export async function writeBookingToCalendar(
  userId: string,
  event: NewCalendarEvent,
): Promise<WrittenEvent | null> {
  const target = await targetCalendar(userId);
  if (!target) return null;

  const adapter = await adapterForConnection(target.connection);
  const created = await adapter.createEvent(target.calendar.externalId, event);
  return {
    calendarId: target.calendar.id,
    provider: target.connection.provider,
    externalEventId: created.externalEventId,
    meetingUrl: created.meetingUrl,
  };
}

/** Best-effort: move the calendar event(s) behind a booking to a new time. */
export async function updateBookingCalendarEvent(
  bookingId: string,
  event: NewCalendarEvent,
): Promise<string | undefined> {
  const db = getDb();
  const refs = await db.query.bookingReferences.findMany({
    where: eq(schema.bookingReferences.bookingId, bookingId),
    with: { calendar: { with: { connection: true } } },
  });
  let meetingUrl: string | undefined;
  for (const ref of refs) {
    try {
      const adapter = await adapterForConnection(ref.calendar.connection);
      const updated = await adapter.updateEvent(
        ref.calendar.externalId,
        ref.externalEventId,
        event,
      );
      meetingUrl ??= updated.meetingUrl;
    } catch (err) {
      console.error("[reschedule] calendar update failed:", err);
    }
  }
  return meetingUrl;
}

/** Best-effort: delete the calendar event(s) behind a booking (on cancel). */
export async function deleteBookingFromCalendar(bookingId: string): Promise<void> {
  const db = getDb();
  const refs = await db.query.bookingReferences.findMany({
    where: eq(schema.bookingReferences.bookingId, bookingId),
    with: { calendar: { with: { connection: true } } },
  });
  for (const ref of refs) {
    try {
      const adapter = await adapterForConnection(ref.calendar.connection);
      await adapter.deleteEvent(ref.calendar.externalId, ref.externalEventId);
    } catch {
      // Non-fatal: the booking is cancelled in calSync regardless.
    }
  }
}
