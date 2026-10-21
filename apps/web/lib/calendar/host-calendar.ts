import type { NewCalendarEvent } from "@dayotter/calendar";
import { and, eq, getDb, schema } from "@dayotter/db";
import { adapterForConnection } from "@dayotter/integrations";

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
    // Never write to a read-only source (e.g. an ICS feed) - pick a writable
    // calendar: the chosen booking target if set, else the first writable one.
    const cal =
      conn.calendars.find((c) => c.isTargetForBookings && !c.isReadOnly) ??
      conn.calendars.find((c) => !c.isReadOnly);
    if (cal) return { connection: conn, calendar: cal };
  }
  return null;
}

/**
 * Google sends its own invite / update / cancellation to every guest (sendUpdates
 * = "all"): in the guest's language, with RSVP buttons and the Meet link. When
 * that happens DayOtter skips its own guest email so nobody gets two messages
 * for one action. DAYOTTER_GUEST_EMAILS_WHEN_CALENDAR=1 restores both.
 */
export function googleEmailsGuests(provider: string | null | undefined): boolean {
  return provider === "google" && process.env.DAYOTTER_GUEST_EMAILS_WHEN_CALENDAR !== "1";
}

/** Calendar-event description carrying the DayOtter self-service link, since the
 * provider's invite may be the only message the guest receives. */
export function withManageLink(description: string | null | undefined, manageUrl: string): string {
  return [description?.trim(), `Reschedule or cancel: ${manageUrl}`].filter(Boolean).join("\n\n");
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

  const db = getDb();
  try {
    const adapter = await adapterForConnection(target.connection);
    const created = await adapter.createEvent(target.calendar.externalId, event);
    // Clear any stale error now that a write has succeeded.
    if (target.connection.lastError) {
      await db
        .update(schema.calendarConnections)
        .set({ lastError: null })
        .where(eq(schema.calendarConnections.id, target.connection.id));
    }
    return {
      calendarId: target.calendar.id,
      provider: target.connection.provider,
      externalEventId: created.externalEventId,
      meetingUrl: created.meetingUrl,
    };
  } catch (err) {
    // Record WHY the write failed so it surfaces in Settings → Calendars
    // instead of vanishing silently. Keep status "active" so the next booking
    // still tries (a transient token/API hiccup shouldn't lock out sync).
    const reason = (err instanceof Error ? err.message : String(err)).slice(0, 300);
    await db
      .update(schema.calendarConnections)
      .set({ lastError: reason })
      .where(eq(schema.calendarConnections.id, target.connection.id))
      .catch(() => {});
    throw err;
  }
}

/** Best-effort: move the calendar event(s) behind a booking to a new time. */
export async function updateBookingCalendarEvent(
  bookingId: string,
  event: NewCalendarEvent,
  /** Filled with how many events were moved where the provider itself emails guests. */
  stats?: { guestsNotified: number },
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
      if (stats && googleEmailsGuests(ref.provider)) stats.guestsNotified++;
    } catch (err) {
      console.error("[reschedule] calendar update failed:", err);
    }
  }
  return meetingUrl;
}

/** Best-effort: delete the calendar event(s) behind a booking (on cancel).
 * Returns how many deletions the provider announced to the guests itself. */
export async function deleteBookingFromCalendar(bookingId: string): Promise<number> {
  const db = getDb();
  const refs = await db.query.bookingReferences.findMany({
    where: eq(schema.bookingReferences.bookingId, bookingId),
    with: { calendar: { with: { connection: true } } },
  });
  let guestsNotified = 0;
  for (const ref of refs) {
    try {
      const adapter = await adapterForConnection(ref.calendar.connection);
      await adapter.deleteEvent(ref.calendar.externalId, ref.externalEventId);
      if (googleEmailsGuests(ref.provider)) guestsNotified++;
    } catch {
      // Non-fatal: the booking is cancelled in DayOtter regardless.
    }
  }
  return guestsNotified;
}
