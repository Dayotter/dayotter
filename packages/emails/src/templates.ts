import { DateTime } from "luxon";

export interface BookingEmailData {
  eventTitle: string;
  start: Date;
  end: Date;
  /** Timezone to render times in (usually the recipient's). */
  timezone: string;
  hostName: string;
  attendeeName: string;
  location?: string;
  meetingUrl?: string;
  /** Public link to view / cancel / reschedule the booking. */
  manageUrl: string;
}

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

function fmt(date: Date, tz: string): string {
  return DateTime.fromJSDate(date).setZone(tz).toFormat("cccc, LLLL d, yyyy · h:mm a (ZZZZ)");
}

const ESC: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** HTML-escape any value that could carry user-controlled content (event title,
 * host name, location, meeting URL) before it is interpolated into email HTML. */
function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

function shell(heading: string, lines: string[], cta?: { label: string; url: string }): string {
  const body = lines
    .map((l) => `<p style="margin:0 0 10px;color:#3a3f4b;font-size:14px;line-height:1.6">${l}</p>`)
    .join("");
  const button = cta
    ? `<a href="${esc(cta.url)}" style="display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:500">${esc(cta.label)}</a>`
    : "";
  return `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <h2 style="font-size:18px;color:#0c0e14;margin:0 0 14px">${heading}</h2>
    ${body}${button}
    <p style="margin:24px 0 0;color:#98a0ae;font-size:12px">Sent by calSync</p>
  </div>`;
}

export function bookingConfirmation(d: BookingEmailData): Rendered {
  const when = fmt(d.start, d.timezone);
  const where = d.meetingUrl
    ? `Join: ${d.meetingUrl}`
    : d.location
      ? `Location: ${d.location}`
      : "";
  return {
    subject: `Confirmed: ${d.eventTitle} — ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `Your booking is confirmed.\n\n${d.eventTitle}\nWith: ${d.hostName}\nWhen: ${when}\n${where}\n\nManage or cancel: ${d.manageUrl}`,
    html: shell(
      "Your booking is confirmed 🎉",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}`,
        `🗓 ${when}`,
        where ? `📍 ${esc(where)}` : "",
      ].filter(Boolean),
      { label: "View booking", url: d.manageUrl },
    ),
  };
}

export function bookingReminder(d: BookingEmailData & { leadLabel: string }): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Reminder: ${d.eventTitle} ${d.leadLabel}`,
    text: `Reminder — ${d.eventTitle} with ${d.hostName} is ${d.leadLabel}.\nWhen: ${when}\n${d.meetingUrl ? `Join: ${d.meetingUrl}` : ""}\n\nManage: ${d.manageUrl}`,
    html: shell(
      `Reminder: your meeting is ${esc(d.leadLabel)}`,
      [`<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}`, `🗓 ${when}`],
      d.meetingUrl
        ? { label: "Join call", url: d.meetingUrl }
        : { label: "View booking", url: d.manageUrl },
    ),
  };
}

export function bookingRescheduled(d: BookingEmailData): Rendered {
  const when = fmt(d.start, d.timezone);
  const where = d.meetingUrl
    ? `Join: ${d.meetingUrl}`
    : d.location
      ? `Location: ${d.location}`
      : "";
  return {
    subject: `Rescheduled: ${d.eventTitle} — ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `Your booking has been moved to a new time.\n\n${d.eventTitle} with ${d.hostName}\nNew time: ${when}\n${where}\n\nManage: ${d.manageUrl}`,
    html: shell(
      "Your booking was rescheduled",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} has a new time:`,
        `🗓 ${when}`,
        where ? `📍 ${esc(where)}` : "",
      ].filter(Boolean),
      { label: "View booking", url: d.manageUrl },
    ),
  };
}

export function bookingRunningLate(d: BookingEmailData & { minutes?: number }): Rendered {
  const late = d.minutes ? `about ${d.minutes} minutes late` : "running a few minutes late";
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Running late: ${d.eventTitle}`,
    text: `Heads up — ${d.hostName} is ${late} for ${d.eventTitle} (${when}). Thanks for your patience.${d.meetingUrl ? `\nJoin: ${d.meetingUrl}` : ""}`,
    html: shell(
      "A quick heads-up ⏳",
      [
        `<strong>${esc(d.hostName)}</strong> is ${esc(late)} for <strong>${esc(d.eventTitle)}</strong>.`,
        `🗓 ${when}`,
        "Thanks for your patience — they'll be with you shortly.",
      ],
      d.meetingUrl ? { label: "Join call", url: d.meetingUrl } : undefined,
    ),
  };
}

export function bookingMessage(d: BookingEmailData & { body: string }): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Re: ${d.eventTitle}`,
    text: `${d.body}\n\n— ${d.hostName}\n\n${d.eventTitle}\nWhen: ${when}\nManage or reschedule: ${d.manageUrl}`,
    html: shell(
      `About ${esc(d.eventTitle)}`,
      [
        esc(d.body),
        `— ${esc(d.hostName)}`,
        `🗓 ${when}`,
      ],
      { label: "View or reschedule", url: d.manageUrl },
    ),
  };
}

export function bookingCancellation(d: BookingEmailData): Rendered {
  return {
    subject: `Cancelled: ${d.eventTitle} — ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `This booking has been cancelled.\n\n${d.eventTitle} with ${d.hostName}\nWas: ${fmt(d.start, d.timezone)}`,
    html: shell("Booking cancelled", [
      `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} has been cancelled.`,
      `Was: ${fmt(d.start, d.timezone)}`,
    ]),
  };
}
