import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { sendEmail } from "@dayotter/emails";
import { adapterForConnection } from "@dayotter/integrations";
import { DateTime } from "luxon";

/** Human-friendly "Wed, Jul 15 at 2:00 PM UTC" for an ISO instant. */
function fmt(iso: string): string {
  const dt = DateTime.fromISO(iso, { zone: "utc" });
  return dt.isValid ? dt.toFormat("cccc, LLL d 'at' h:mm a 'UTC'") : iso;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

export interface ComposedEmail {
  subject: string;
  text: string;
  html: string;
}

/** Compose the "can we find another time?" email sent to a meeting's organizer. Pure. */
export function composeProposalEmail(params: {
  fromName: string;
  title: string;
  originalISO: string;
  proposedISO: string;
  message?: string;
}): ComposedEmail {
  const { fromName, title, originalISO, proposedISO, message } = params;
  const note = message?.trim();
  const subject = `Proposed new time: ${title}`;
  const text = `${fromName} proposed a new time for "${title}".

Originally: ${fmt(originalISO)}
Proposed: ${fmt(proposedISO)}${note ? `\n\nNote: ${note}` : ""}

Reply to them directly to confirm.`;
  const html = `<p><strong>${escapeHtml(fromName)}</strong> proposed a new time for "${escapeHtml(title)}".</p>
<p>Originally: ${escapeHtml(fmt(originalISO))}<br/>Proposed: <strong>${escapeHtml(fmt(proposedISO))}</strong></p>${
    note ? `<p>Note: ${escapeHtml(note)}</p>` : ""
  }<p style="color:#666;font-size:13px">Reply to them directly to confirm.</p>`;
  return { subject, text, html };
}

/** Compose the "can you cover this for me?" email sent to a delegate. Pure. */
export function composeDelegateEmail(params: {
  fromName: string;
  title: string;
  startISO: string;
  organizerName?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  message?: string;
}): ComposedEmail {
  const { fromName, title, startISO, organizerName, location, meetingUrl, message } = params;
  const note = message?.trim();
  const subject = `Can you cover a meeting for me? ${title}`;
  const lines = [
    `${fromName} would like you to attend "${title}" on their behalf.`,
    "",
    `When: ${fmt(startISO)}`,
    organizerName ? `Organizer: ${organizerName}` : "",
    location ? `Where: ${location}` : "",
    meetingUrl ? `Join: ${meetingUrl}` : "",
    note ? `\nNote: ${note}` : "",
  ].filter(Boolean);
  const html = `<p><strong>${escapeHtml(fromName)}</strong> would like you to attend "${escapeHtml(
    title,
  )}" on their behalf.</p>
<p>When: ${escapeHtml(fmt(startISO))}${organizerName ? `<br/>Organizer: ${escapeHtml(organizerName)}` : ""}${
    location ? `<br/>Where: ${escapeHtml(location)}` : ""
  }${meetingUrl ? `<br/>Join: <a href="${escapeHtml(meetingUrl)}">${escapeHtml(meetingUrl)}</a>` : ""}</p>${
    note ? `<p>Note: ${escapeHtml(note)}</p>` : ""
  }`;
  return { subject, text: lines.join("\n"), html };
}

/**
 * Propose a new time to a meeting's organizer: email the proposal and (best-
 * effort) mark the invite tentative on the user's calendar. Requires an owned
 * connection so this can't be used as an open email relay.
 */
export async function proposeInviteTime(params: {
  userId: string;
  userName: string;
  connectionId: string;
  calendarExternalId: string;
  externalEventId: string;
  organizerEmail: string;
  title: string;
  originalISO: string;
  proposedISO: string;
  message?: string;
}): Promise<"ok" | "not_found"> {
  const conn = await getDb().query.calendarConnections.findFirst({
    where: and(
      eq(schema.calendarConnections.id, params.connectionId),
      eq(schema.calendarConnections.userId, params.userId),
    ),
  });
  if (!conn) return "not_found";

  const email = composeProposalEmail({
    fromName: params.userName,
    title: params.title,
    originalISO: params.originalISO,
    proposedISO: params.proposedISO,
    message: params.message,
  });
  await sendEmail({ to: params.organizerEmail, ...email });

  // Best-effort: reflect the pending decision as tentative on the provider.
  try {
    const adapter = await adapterForConnection(conn);
    await adapter.respondToInvite?.(params.calendarExternalId, params.externalEventId, "tentative");
  } catch (err) {
    logger.warn("propose: tentative RSVP failed (email still sent)", {
      event: "invite_propose_rsvp_failed",
      userId: params.userId,
      err,
    });
  }
  return "ok";
}

/** Delegate an invite to a teammate by emailing them the meeting details. */
export async function delegateInvite(params: {
  userName: string;
  delegateEmail: string;
  title: string;
  startISO: string;
  organizerName?: string | null;
  location?: string | null;
  meetingUrl?: string | null;
  message?: string;
}): Promise<"ok"> {
  const email = composeDelegateEmail({ fromName: params.userName, ...params });
  await sendEmail({ to: params.delegateEmail, ...email });
  return "ok";
}
