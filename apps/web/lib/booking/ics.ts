import { DateTime } from "luxon";

export interface CalendarEventData {
  uid: string;
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  location?: string | null;
  meetingUrl?: string | null;
}

/** UTC timestamp in iCalendar basic format, e.g. 20260708T090000Z. */
function utc(d: Date): string {
  return DateTime.fromJSDate(d).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

/** Escape a value for an iCalendar text field (RFC 5545 §3.3.11). */
function escapeText(v: string): string {
  return v
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function locationValue(e: CalendarEventData): string {
  return e.meetingUrl || e.location || "";
}

/** A complete VCALENDAR document for one booking, suitable for a .ics download. */
export function buildIcs(e: CalendarEventData): string {
  const now = utc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//dayotter//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@calsync`,
    `DTSTAMP:${now}`,
    `DTSTART:${utc(e.start)}`,
    `DTEND:${utc(e.end)}`,
    `SUMMARY:${escapeText(e.title)}`,
    e.description ? `DESCRIPTION:${escapeText(e.description)}` : null,
    locationValue(e) ? `LOCATION:${escapeText(locationValue(e))}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return `${lines.join("\r\n")}\r\n`;
}

/** A "add to Google Calendar" template URL for one booking. */
export function googleCalendarUrl(e: CalendarEventData): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${utc(e.start)}/${utc(e.end)}`,
  });
  const details = [e.description, e.meetingUrl].filter(Boolean).join("\n\n");
  if (details) params.set("details", details);
  const loc = locationValue(e);
  if (loc) params.set("location", loc);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
