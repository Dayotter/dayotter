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
  /** Optional host-written note shown on cancel/reschedule emails. */
  reason?: string | null;
  /** Optional host-written meeting details (Zoom link, address, ...) appended
   * to the booking confirmation. Rendered with line breaks preserved. */
  message?: string | null;
  /** Who made the booking (the primary attendee). Shown when known. */
  booker?: { name?: string; email: string };
  /** Additional people on the booking beyond the booker (guests). */
  addedAttendees?: { name?: string; email: string }[];
}

interface Rendered {
  subject: string;
  text: string;
  html: string;
}

export interface PollInvitationData {
  pollTitle: string;
  hostName: string;
  voteUrl: string;
  optionCount: number;
  /** Optional host-written note ("bring your laptop", "here's the agenda"...) shown
   * with the invitation, or when the host shares the public link directly. */
  message?: string;
}

export interface PollVoteUpdateData {
  pollTitle: string;
  voterName: string;
  voterEmail: string;
  participationLabel: string;
  resultsUrl: string;
  timezone: string;
  options: { startsAt: Date; yes: number; maybe: number; no: number }[];
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

/** Only ever render http(s) URLs in an href. A `javascript:`/`data:` URL (even though
 *  these are host-generated) would otherwise reach the anchor; mirror the client-side
 *  `^https?://` guard in slot-picker.tsx. Falls back to a harmless "#". */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : "#";
}

/** Render a host-written multi-line note for email HTML: escape once, then keep
 * blank-line paragraph breaks and <br/> for single line breaks inside one <p>. */
function messageParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => esc(paragraph).replace(/\n/g, "<br/>"))
    .filter((paragraph) => paragraph.length > 0);
}

/** "Name <email>" when a name is present, the bare email otherwise. */
function personLabel(p: { name?: string; email: string }): string {
  return p.name ? `${p.name} <${p.email}>` : p.email;
}

function shell(
  heading: string,
  lines: string[],
  cta?: { label: string; url: string },
  /** Lifecycle/marketing emails only: renders an Unsubscribe link in the footer. */
  unsubscribeUrl?: string,
): string {
  const body = lines
    .map((l) => `<p style="margin:0 0 10px;color:#3a3f4b;font-size:14px;line-height:1.6">${l}</p>`)
    .join("");
  const button = cta
    ? `<a href="${esc(safeUrl(cta.url))}" style="display:inline-block;margin-top:12px;background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:500">${esc(cta.label)}</a>`
    : "";
  const footer = unsubscribeUrl
    ? `<p style="margin:24px 0 0;color:#98a0ae;font-size:12px">Sent by DayOtter · <a href="${esc(safeUrl(unsubscribeUrl))}" style="color:#98a0ae;text-decoration:underline">Unsubscribe from tips</a></p>`
    : `<p style="margin:24px 0 0;color:#98a0ae;font-size:12px">Sent by DayOtter</p>`;
  return `<div style="max-width:520px;margin:0 auto;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <h2 style="font-size:18px;color:#0c0e14;margin:0 0 14px">${heading}</h2>
    ${body}${button}
    ${footer}
  </div>`;
}

export function pollInvitation(d: PollInvitationData): Rendered {
  const note = d.message ? messageParagraphs(d.message) : [];
  return {
    subject: `Vote on a time: ${d.pollTitle}`,
    text: `${d.hostName} invited you to vote on a time for ${d.pollTitle}.\n\nThere are ${d.optionCount} proposed times.\n${d.message ? `\n${d.message}\n` : ""}Vote here: ${d.voteUrl}`,
    html: shell(
      `${esc(d.hostName)} is finding a time`,
      [
        `You were invited to vote on <strong>${esc(d.pollTitle)}</strong>.`,
        `Choose what works for you from ${d.optionCount} proposed times.`,
        ...note,
      ],
      { label: "Vote on times", url: d.voteUrl },
    ),
  };
}

export function pollVoteUpdate(d: PollVoteUpdateData): Rendered {
  const summaries = d.options.map((option) => {
    const when = DateTime.fromJSDate(option.startsAt)
      .setZone(d.timezone)
      .toFormat("ccc, LLL d · h:mm a");
    return `${when}: ${option.yes} yes, ${option.maybe} maybe, ${option.no} no`;
  });
  return {
    subject: `New vote: ${d.pollTitle}`,
    text: `${d.voterName} (${d.voterEmail}) submitted or updated a vote on ${d.pollTitle}.\n\nPoll status: Open · ${d.participationLabel}\n\n${summaries.join("\n")}\n\nView results: ${d.resultsUrl}`,
    html: shell(
      `New vote on ${esc(d.pollTitle)}`,
      [
        `<strong>${esc(d.voterName)}</strong> (${esc(d.voterEmail)}) submitted or updated a vote.`,
        `Poll status: <strong>Open</strong> · ${esc(d.participationLabel)}`,
        ...summaries.map((summary) => esc(summary)),
      ],
      { label: "View poll results", url: d.resultsUrl },
    ),
  };
}

export function bookingConfirmation(d: BookingEmailData): Rendered {
  const when = fmt(d.start, d.timezone);
  const where = d.meetingUrl
    ? `Join: ${d.meetingUrl}`
    : d.location
      ? `Location: ${d.location}`
      : "";
  const note = d.message ? messageParagraphs(d.message) : [];
  // Who booked it + anyone added alongside them (shown when known).
  const extras = [
    d.booker ? `Booked by: ${personLabel(d.booker)}` : "",
    d.addedAttendees && d.addedAttendees.length > 0
      ? `Also attending: ${d.addedAttendees.map(personLabel).join(", ")}`
      : "",
  ].filter(Boolean);
  return {
    subject: `Confirmed: ${d.eventTitle} - ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `Your booking is confirmed.\n\n${d.eventTitle}\nWith: ${d.hostName}\n${extras.join("\n")}${extras.length > 0 ? "\n" : ""}When: ${when}\n${where}\n${d.message ? `\n${d.message}\n` : ""}\nManage or cancel: ${d.manageUrl}`,
    html: shell(
      "Your booking is confirmed 🎉",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}`,
        ...extras.map((line) => esc(line)),
        `🗓 ${when}`,
        where ? `📍 ${esc(where)}` : "",
        ...note,
      ].filter(Boolean),
      { label: "View booking", url: d.manageUrl },
    ),
  };
}

export interface GuardrailAlertData {
  /** First name of the workspace owner being alerted. */
  ownerName?: string;
  /** Human label for where it happened, e.g. "the assistant chat". */
  sourceLabel: string;
  /** The offending input (already trimmed), shown so the owner can judge it. */
  sample: string;
  /** Formatted time of the most recent hit. */
  when: string;
  /** How many guardrail hits in the throttle window this email covers. */
  count: number;
  /** Link to the dashboard security log. */
  reviewUrl: string;
}

/**
 * Security alert to a workspace owner: the AI assistant blocked a suspicious
 * (injection / jailbreak) request. Informational - no action is required, since
 * the guardrail already refused; it exists so owners have visibility.
 */
export function guardrailAlert(d: GuardrailAlertData): Rendered {
  const hello = d.ownerName ? `Hi ${d.ownerName}, ` : "";
  const summary =
    d.count > 1
      ? `${hello}the DayOtter assistant blocked ${d.count} suspicious requests in ${d.sourceLabel}. The most recent was at ${d.when}.`
      : `${hello}the DayOtter assistant blocked a suspicious request in ${d.sourceLabel} at ${d.when}.`;
  return {
    subject:
      d.count > 1
        ? `DayOtter security: ${d.count} requests blocked by the assistant`
        : "DayOtter security: the assistant blocked a suspicious request",
    text: `${summary}\n\nThe assistant refused automatically - nothing was changed on your calendar and no action is needed. This note is just so you have visibility.\n\nMost recent input:\n"${d.sample}"\n\nReview the security log: ${d.reviewUrl}`,
    html: shell(
      "The assistant blocked a suspicious request",
      [
        summary,
        "The assistant refused automatically, so nothing was changed on your calendar and no action is needed. This note is just so you have visibility.",
        `<span style="color:#6b7280">Most recent input:</span><br><em>${esc(d.sample)}</em>`,
      ],
      { label: "Review security log", url: d.reviewUrl },
    ),
  };
}

export function bookingReminder(d: BookingEmailData & { leadLabel: string }): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Reminder: ${d.eventTitle} ${d.leadLabel}`,
    text: `Reminder - ${d.eventTitle} with ${d.hostName} is ${d.leadLabel}.\nWhen: ${when}\n${d.meetingUrl ? `Join: ${d.meetingUrl}` : ""}\n\nManage: ${d.manageUrl}`,
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
    subject: `Thanks for meeting - ${d.eventTitle}`,
    text: `Thanks for taking the time to meet about ${d.eventTitle} with ${d.hostName}. If anything came up or you'd like to follow up, just reply - or book another time: ${d.manageUrl}`,
    html: shell(
      "Thanks for meeting 🙌",
      [
        `Thanks for taking the time to meet about <strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}.`,
        "If anything came up, just reply to this email - or grab another time below.",
      ],
      { label: "Book another time", url: d.manageUrl },
    ),
  };
}

/** Sent after a meeting the attendee missed - warm, with a rebook link. */
export function bookingNoShowFollowUp(d: BookingEmailData): Rendered {
  return {
    subject: `Sorry we missed you - ${d.eventTitle}`,
    text: `We had ${d.eventTitle} with ${d.hostName} on the calendar but didn't get to connect. No worries - grab a new time whenever it suits you: ${d.manageUrl}`,
    html: shell(
      "Sorry we missed you",
      [
        `We had <strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} on the calendar but didn't get to connect.`,
        "No worries at all - grab a new time whenever it suits you.",
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
  const note = d.reason ? `Reason: ${d.reason}` : "";
  return {
    subject: `Rescheduled: ${d.eventTitle} - ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `Your booking has been moved to a new time.\n\n${d.eventTitle} with ${d.hostName}\nNew time: ${when}\n${where}${note ? `\n\n${note}` : ""}\n\nManage: ${d.manageUrl}`,
    html: shell(
      "Your booking was rescheduled",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} has a new time:`,
        `🗓 ${when}`,
        where ? `📍 ${esc(where)}` : "",
        note ? `💬 ${esc(note)}` : "",
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
    text: `Heads up - ${d.hostName} is ${late} for ${d.eventTitle} (${when}). Thanks for your patience.${d.meetingUrl ? `\nJoin: ${d.meetingUrl}` : ""}`,
    html: shell(
      "A quick heads-up ⏳",
      [
        `<strong>${esc(d.hostName)}</strong> is ${esc(late)} for <strong>${esc(d.eventTitle)}</strong>.`,
        `🗓 ${when}`,
        "Thanks for your patience - they'll be with you shortly.",
      ],
      d.meetingUrl ? { label: "Join call", url: d.meetingUrl } : undefined,
    ),
  };
}

export function bookingMessage(d: BookingEmailData & { body: string }): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Re: ${d.eventTitle}`,
    text: `${d.body}\n\n- ${d.hostName}\n\n${d.eventTitle}\nWhen: ${when}\nManage or reschedule: ${d.manageUrl}`,
    html: shell(`About ${esc(d.eventTitle)}`, [esc(d.body), `- ${esc(d.hostName)}`, `🗓 ${when}`], {
      label: "View or reschedule",
      url: d.manageUrl,
    }),
  };
}

/**
 * Sent to the ATTENDEE when they book an event that needs host approval. The
 * booking is held as `pending` - nothing is on anyone's calendar yet.
 */
export function bookingRequested(d: BookingEmailData): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Request sent: ${d.eventTitle} - ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `Thanks - your request has been sent.\n\n${d.eventTitle} with ${d.hostName}\nRequested: ${when}\n\n${d.hostName} will review it; you'll get a confirmation email the moment it's approved.\n\nView or withdraw: ${d.manageUrl}`,
    html: shell(
      "Your request has been sent ✋",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)}`,
        `🗓 ${when}`,
        `This event needs ${esc(d.hostName)}'s approval. We'll email you the moment it's confirmed - nothing is on the calendar yet.`,
      ],
      { label: "View request", url: d.manageUrl },
    ),
  };
}

/**
 * Sent to the HOST when a booking request is awaiting their approval. `manageUrl`
 * should point at the host's bookings dashboard where they approve / decline.
 */
export function newBookingRequest(d: BookingEmailData): Rendered {
  const when = fmt(d.start, d.timezone);
  return {
    subject: `Approve? ${d.eventTitle} - ${d.attendeeName}`,
    text: `${d.attendeeName} requested ${d.eventTitle}.\nWhen: ${when}\n\nApprove or decline it: ${d.manageUrl}`,
    html: shell(
      "New booking request",
      [
        `<strong>${esc(d.attendeeName)}</strong> requested <strong>${esc(d.eventTitle)}</strong>.`,
        `🗓 ${when}`,
        "It's on hold until you approve or decline it.",
      ],
      { label: "Review request", url: d.manageUrl },
    ),
  };
}

/** Sent to the ATTENDEE when the host declines a pending request. */
export function bookingDeclined(d: BookingEmailData): Rendered {
  const note = d.reason ? `Reason: ${d.reason}` : "";
  return {
    subject: `Not confirmed: ${d.eventTitle}`,
    text: `Unfortunately ${d.hostName} couldn't confirm your request for ${d.eventTitle} (${fmt(d.start, d.timezone)}).${note ? `\n\n${note}` : ""}\n\nYou're welcome to pick another time: ${d.manageUrl}`,
    html: shell(
      "Your request wasn't confirmed",
      [
        `Unfortunately ${esc(d.hostName)} couldn't confirm <strong>${esc(d.eventTitle)}</strong>.`,
        `Requested: ${fmt(d.start, d.timezone)}`,
        note ? `💬 ${esc(note)}` : "",
      ].filter(Boolean),
      { label: "Pick another time", url: d.manageUrl },
    ),
  };
}

export function bookingCancellation(d: BookingEmailData): Rendered {
  const note = d.reason ? `Reason: ${d.reason}` : "";
  return {
    subject: `Cancelled: ${d.eventTitle} - ${DateTime.fromJSDate(d.start).setZone(d.timezone).toFormat("LLL d, h:mm a")}`,
    text: `This booking has been cancelled.\n\n${d.eventTitle} with ${d.hostName}\nWas: ${fmt(d.start, d.timezone)}${note ? `\n\n${note}` : ""}`,
    html: shell(
      "Booking cancelled",
      [
        `<strong>${esc(d.eventTitle)}</strong> with ${esc(d.hostName)} has been cancelled.`,
        `Was: ${fmt(d.start, d.timezone)}`,
        note ? `💬 ${esc(note)}` : "",
      ].filter(Boolean),
    ),
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
    text: `${bodyText}\n\n- ${d.hostName}\n\nView or reschedule: ${d.manageUrl}`,
    html: shell(
      esc(d.heading),
      [...paragraphs.map((p) => esc(p)), `- ${esc(d.hostName)}`].filter(Boolean),
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
 * The daily "morning briefing" - a calm summary of the day ahead, sent each
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
      ? "No meetings scheduled - a clear runway ahead."
      : `You have ${count} meeting${count === 1 ? "" : "s"} today:`,
    ...d.meetings.map((m) => `<strong>${esc(m.time)}</strong> - ${esc(m.title)}`),
  ];
  if (d.focusLabel) lines.push(esc(d.focusLabel));
  const textBody =
    count === 0
      ? "No meetings scheduled today."
      : d.meetings.map((m) => `${m.time} - ${m.title}`).join("\n");
  return {
    subject,
    text: `${d.dateLabel}\n${textBody}${d.focusLabel ? `\n${d.focusLabel}` : ""}\n\nOpen DayOtter: ${d.manageUrl}`,
    html: shell("Your morning briefing", lines, { label: "Open DayOtter", url: d.manageUrl }),
  };
}

export interface TeamBriefingData {
  /** Recipient's first name (may be empty). */
  name: string;
  teamName: string;
  /** Local date label, e.g. "Tuesday, July 14". */
  dateLabel: string;
  /** Total meetings across the team today. */
  totalMeetings: number;
  /** Per-member load, highest first. */
  perMember: { name: string; count: number }[];
  /** Optional team focus-time summary. */
  focusLabel?: string;
  manageUrl: string;
}

/** Shared daily team digest - the team's meeting load for the day. */
export function teamBriefing(d: TeamBriefingData): Rendered {
  const subject =
    d.totalMeetings === 0
      ? `${d.teamName}: a clear team day`
      : `${d.teamName}: ${d.totalMeetings} meeting${d.totalMeetings === 1 ? "" : "s"} today`;
  const busiest = d.perMember[0];
  const lines = [
    `Good morning${d.name ? `, ${esc(d.name)}` : ""}. Here's ${esc(d.teamName)} for ${esc(d.dateLabel)}.`,
    d.totalMeetings === 0
      ? "No meetings on the team's calendar today - a clear runway."
      : `The team has <strong>${d.totalMeetings}</strong> meeting${d.totalMeetings === 1 ? "" : "s"} today${busiest ? `, most on ${esc(busiest.name)} (${busiest.count})` : ""}.`,
    ...d.perMember
      .filter((m) => m.count > 0)
      .map(
        (m) => `<strong>${esc(m.name)}</strong> - ${m.count} meeting${m.count === 1 ? "" : "s"}`,
      ),
  ];
  if (d.focusLabel) lines.push(esc(d.focusLabel));
  const textBody = d.perMember
    .filter((m) => m.count > 0)
    .map((m) => `${m.name} - ${m.count}`)
    .join("\n");
  return {
    subject,
    text: `${d.teamName} - ${d.dateLabel}\n${d.totalMeetings} meetings today\n${textBody}${d.focusLabel ? `\n${d.focusLabel}` : ""}\n\nOpen DayOtter: ${d.manageUrl}`,
    html: shell(`${esc(d.teamName)} - today`, lines, { label: "Open DayOtter", url: d.manageUrl }),
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
 * Post-meeting recap ("Scribe") - sent to the HOST shortly after a meeting ends.
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

// ---- Lifecycle / activation nudges (gated by the productEmails preference) ----

export interface ActivationEmailData {
  /** Recipient's first name (may be empty). */
  name: string;
  /** The host's own public booking link, e.g. https://app/ada. */
  bookingUrl: string;
  /** Dashboard URL. */
  manageUrl: string;
  /** One-click unsubscribe (flips off productEmails). */
  unsubscribeUrl: string;
}

/**
 * Sent to a host who set up DayOtter but hasn't been booked yet - the sharpest
 * activation leak. Founder voice, one job: get them to share their link.
 */
export function activationShareLink(d: ActivationEmailData): Rendered {
  const hi = d.name ? `Hi ${esc(d.name)},` : "Hi,";
  const lines = [
    `${hi} you set DayOtter up but haven't shared your booking link yet, and that link is really the whole point.`,
    "Send it once and anyone can grab a time that works for both of you, with none of the back and forth.",
    `Here's yours: <a href="${esc(safeUrl(d.bookingUrl))}">${esc(d.bookingUrl)}</a>`,
    "Drop it in your email signature or a reply and the first booking usually lands within a day.",
  ];
  return {
    subject: "Your booking link is ready to share",
    text: `${d.name ? `Hi ${d.name},` : "Hi,"} you set DayOtter up but haven't shared your booking link yet.\n\nHere's yours: ${d.bookingUrl}\n\nDrop it in your email signature or a reply, and the first booking usually lands within a day.\n\nOpen your page: ${d.manageUrl}\n\nUnsubscribe from tips: ${d.unsubscribeUrl}`,
    html: shell(
      "Share your link and let people book you",
      lines,
      { label: "Open your booking page", url: d.bookingUrl },
      d.unsubscribeUrl,
    ),
  };
}

/**
 * Sent to a host who signed up but never connected a calendar - the top-of-funnel
 * leak. Nudges the one setup step that makes availability real.
 */
export function activationConnectCalendar(d: ActivationEmailData): Rendered {
  const hi = d.name ? `Hi ${esc(d.name)},` : "Hi,";
  const lines = [
    `${hi} welcome to DayOtter. You're one step from being bookable.`,
    "Connect your Google, Outlook or Apple calendar and DayOtter only ever offers times when you're actually free, then writes each booking straight back onto it.",
    "It takes about a minute, and nothing double-books after that.",
  ];
  return {
    subject: "Connect your calendar so you never double-book",
    text: `${d.name ? `Hi ${d.name},` : "Hi,"} welcome to DayOtter. Connect your Google, Outlook or Apple calendar and you'll only ever be offered times you're actually free.\n\nConnect it: ${d.manageUrl}\n\nUnsubscribe from tips: ${d.unsubscribeUrl}`,
    html: shell(
      "One step to being bookable",
      lines,
      { label: "Connect your calendar", url: d.manageUrl },
      d.unsubscribeUrl,
    ),
  };
}

export interface WeeklyDigestData {
  name: string;
  /** Meetings hosted in the week just gone. */
  meetings: number;
  /** Hours in those meetings (rounded to 0.1). */
  hours: number;
  /** Hours of focus/held time protected in the week (rounded to 0.1). */
  focusHours: number;
  /** Meetings already on the books for the week ahead. */
  upcoming: number;
  manageUrl: string;
  unsubscribeUrl: string;
}

/**
 * Weekly retention digest: a calm "here's your week" recap sent Monday morning.
 * Reinforces the value (time booked + focus protected) and pulls the host back in.
 */
export function weeklyDigest(d: WeeklyDigestData): Rendered {
  const hi = d.name ? `Hi ${esc(d.name)},` : "Hi,";
  const quiet = d.meetings === 0 && d.focusHours === 0;
  const lines = quiet
    ? [
        `${hi} last week was quiet on DayOtter, no meetings booked.`,
        "If your link isn't out there yet, this is a good week to share it. One link, and people can grab a time that works for both of you.",
      ]
    : [
        `${hi} here's your week just gone:`,
        `<strong>${d.meetings}</strong> meeting${d.meetings === 1 ? "" : "s"} hosted, about <strong>${d.hours}</strong> hour${d.hours === 1 ? "" : "s"} of your time.`,
        d.focusHours > 0
          ? `<strong>${d.focusHours}</strong> hour${d.focusHours === 1 ? "" : "s"} of focus time protected.`
          : "",
        d.upcoming > 0
          ? `${d.upcoming} already on the books for the week ahead.`
          : "Nothing booked yet for the week ahead.",
      ].filter(Boolean);
  return {
    subject: quiet
      ? "Your week on DayOtter"
      : `Your week on DayOtter: ${d.meetings} meeting${d.meetings === 1 ? "" : "s"}`,
    text: `${d.name ? `Hi ${d.name},` : "Hi,"}\n\nLast week: ${d.meetings} meetings (${d.hours}h), ${d.focusHours}h focus protected. ${d.upcoming} coming up.\n\nOpen DayOtter: ${d.manageUrl}\n\nUnsubscribe from tips: ${d.unsubscribeUrl}`,
    html: shell(
      "Your week on DayOtter",
      lines,
      { label: "Open DayOtter", url: d.manageUrl },
      d.unsubscribeUrl,
    ),
  };
}

/**
 * Celebrates a host's first booking - the activation "aha". Warm, and nudges the
 * repeat behaviour (share more, connect a calendar if they haven't).
 */
export function firstBookingCelebration(d: ActivationEmailData): Rendered {
  const hi = d.name ? `${esc(d.name)}, ` : "";
  const lines = [
    `${hi}you just got your first booking on DayOtter. That's the whole thing working: someone picked a time, and it's on your calendar.`,
    "Keep the link handy and it'll keep happening. The people who share it in their signature or bio get booked the most.",
    `Your link: <a href="${esc(safeUrl(d.bookingUrl))}">${esc(d.bookingUrl)}</a>`,
  ];
  return {
    subject: "🎉 Your first booking is in",
    text: `${d.name ? `${d.name}, ` : ""}you just got your first booking on DayOtter.\n\nKeep sharing your link: ${d.bookingUrl}\n\nOpen DayOtter: ${d.manageUrl}\n\nUnsubscribe from tips: ${d.unsubscribeUrl}`,
    html: shell(
      "Your first booking is in 🎉",
      lines,
      { label: "See it on your dashboard", url: d.manageUrl },
      d.unsubscribeUrl,
    ),
  };
}
