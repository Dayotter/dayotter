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
    <p style="margin:24px 0 0;color:#98a0ae;font-size:12px">Sent by DayOtter</p>
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

export function bookingFollowUp(d: BookingEmailData): Rendered {
  return {
    subject: `Thanks for meeting — ${d.eventTitle}`,
    text: `Thanks for taking the time to meet about ${d.eventTitle} with ${d.hostName}. If anything came up or you'd like to follow up, just reply — or book another time: ${d.manageUrl}`,
    html: shell(
      "Thanks for meeting 🙌",
      [
        `Thanks for taking the time to meet about <strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}.`,
        "If anything came up, just reply to this email — or grab another time below.",
      ],
      { label: "Book another time", url: d.manageUrl },
    ),
  };
}

/** Sent after a meeting the attendee missed — warm, with a rebook link. */
export function bookingNoShowFollowUp(d: BookingEmailData): Rendered {
  return {
    subject: `Sorry we missed you — ${d.eventTitle}`,
    text: `We had ${d.eventTitle} with ${d.hostName} on the calendar but didn't get to connect. No worries — grab a new time whenever it suits you: ${d.manageUrl}`,
    html: shell(
      "Sorry we missed you",
      [
        `We had <strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} on the calendar but didn't get to connect.`,
        "No worries at all — grab a new time whenever it suits you.",
      ],
      { label: "Pick a new time", url: d.manageUrl },
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
    html: shell(`About ${esc(d.eventTitle)}`, [esc(d.body), `— ${esc(d.hostName)}`, `🗓 ${when}`], {
      label: "View or reschedule",
      url: d.manageUrl,
    }),
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

/**
 * The placeholders a host may use in a workflow's subject/body. Kept here so the
 * settings UI and the renderer agree on exactly one vocabulary.
 */
export const WORKFLOW_VARIABLES = [
  "attendee_name",
  "host_name",
  "event_title",
  "event_date",
  "location",
  "meeting_url",
  "manage_url",
] as const;

/** Substitute `{{variable}}` tokens (case/space tolerant) from a value map. */
export function applyTemplateVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, key: string) => {
    const v = vars[key.toLowerCase()];
    return v ?? "";
  });
}

/**
 * A host-authored workflow email. `subjectTemplate`/`bodyTemplate` may contain
 * `{{variable}}` placeholders (see WORKFLOW_VARIABLES); the body's blank-line
 * separated paragraphs are rendered into the standard shell.
 */
export function workflowEmail(
  d: BookingEmailData & { subjectTemplate: string; bodyTemplate: string; heading: string },
): Rendered {
  const vars: Record<string, string> = {
    attendee_name: d.attendeeName,
    host_name: d.hostName,
    event_title: d.eventTitle,
    event_date: fmt(d.start, d.timezone),
    location: d.location ?? "",
    meeting_url: d.meetingUrl ?? "",
    manage_url: d.manageUrl,
  };
  const subject = applyTemplateVars(d.subjectTemplate, vars).trim() || `About ${d.eventTitle}`;
  const bodyText = applyTemplateVars(d.bodyTemplate, vars).trim();
  const paragraphs = bodyText.split(/\n{2,}/).map((p) => p.replace(/\n/g, " ").trim());
  return {
    subject,
    text: `${bodyText}\n\n— ${d.hostName}\n\nView or reschedule: ${d.manageUrl}`,
    html: shell(
      esc(d.heading),
      [...paragraphs.map((p) => esc(p)), `— ${esc(d.hostName)}`].filter(Boolean),
      { label: "View or reschedule", url: d.manageUrl },
    ),
  };
}

export interface DailyBriefingData {
  /** Recipient's first name (may be empty). */
  name: string;
  /** Local date label, e.g. "Tuesday, July 14". */
  dateLabel: string;
  /** Today's meetings, pre-formatted in the recipient's timezone. */
  meetings: { time: string; title: string }[];
  /** Optional focus-time summary, e.g. "2 hours of focus held". */
  focusLabel?: string;
  manageUrl: string;
}

/**
 * The daily "morning briefing" — a calm summary of the day ahead, sent each
 * morning to hosts who opt in. Mirrors the multi-channel nudge the worker also
 * delivers over SMS/WhatsApp/Slack/push.
 */
export function dailyBriefing(d: DailyBriefingData): Rendered {
  const count = d.meetings.length;
  const subject =
    count === 0
      ? "Your day: a clear calendar"
      : `Your day: ${count} meeting${count === 1 ? "" : "s"}`;
  const greeting = `Good morning${d.name ? `, ${esc(d.name)}` : ""}. Here's ${esc(d.dateLabel)}.`;
  const lines = [
    greeting,
    count === 0
      ? "No meetings scheduled — a clear runway ahead."
      : `You have ${count} meeting${count === 1 ? "" : "s"} today:`,
    ...d.meetings.map((m) => `<strong>${esc(m.time)}</strong> — ${esc(m.title)}`),
  ];
  if (d.focusLabel) lines.push(esc(d.focusLabel));
  const textBody =
    count === 0
      ? "No meetings scheduled today."
      : d.meetings.map((m) => `${m.time} — ${m.title}`).join("\n");
  return {
    subject,
    text: `${d.dateLabel}\n${textBody}${d.focusLabel ? `\n${d.focusLabel}` : ""}\n\nOpen DayOtter: ${d.manageUrl}`,
    html: shell("Your morning briefing", lines, { label: "Open DayOtter", url: d.manageUrl }),
  };
}

export interface MeetingRecapData {
  /** Host's first name (may be empty). */
  hostName: string;
  eventTitle: string;
  start: Date;
  end: Date;
  timezone: string;
  /** Attendee display names/emails. */
  attendees: string[];
  /** Deep links for the one-tap next steps. */
  bookAgainUrl: string;
  messageUrl: string;
  manageUrl: string;
}

/**
 * Post-meeting recap ("Scribe") — sent to the HOST shortly after a meeting ends.
 * A calm prompt to capture notes and take the obvious next steps, with one-tap
 * links into the actions DayOtter already supports.
 */
export function meetingRecap(d: MeetingRecapData): Rendered {
  const when = fmt(d.start, d.timezone);
  const who = d.attendees.length > 0 ? d.attendees.map(esc).join(", ") : "your guest";
  const lines = [
    `Your meeting <strong>${esc(d.eventTitle)}</strong> just wrapped.`,
    `${esc(when)} · with ${who}.`,
    "A good moment to capture what you agreed and line up the next step:",
    `• <a href="${esc(d.bookAgainUrl)}">Book a follow-up</a>`,
    `• <a href="${esc(d.messageUrl)}">Send a recap to attendees</a>`,
    `• <a href="${esc(d.manageUrl)}">View the meeting</a>`,
  ];
  return {
    subject: `Recap: ${d.eventTitle}`,
    text: `Your meeting "${d.eventTitle}" just wrapped.\n${when} · with ${d.attendees.join(", ") || "your guest"}.\n\nBook a follow-up: ${d.bookAgainUrl}\nSend a recap: ${d.messageUrl}\nView: ${d.manageUrl}`,
    html: shell(`How did it go${d.hostName ? `, ${esc(d.hostName)}` : ""}?`, lines),
  };
}
