import { randomBytes } from "node:crypto";
import { logger } from "@dayotter/core";
import { and, asc, eq, getDb, inArray, schema } from "@dayotter/db";
import { bookingConfirmation, pollInvitation, pollVoteUpdate, sendEmail } from "@dayotter/emails";
import { AUTO_CONFERENCE, LOCATION_LABELS } from "../booking/event-type-input";
import { writeBookingToCalendar } from "../calendar/host-calendar";
import { applyCalendarMessage, applyFinalizeMessage } from "./message-templates";

export class PollError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const VOTE_RESPONSES = new Set(["yes", "no", "maybe"]);

export interface CreatePollInput {
  title: string;
  description?: string;
  durationMinutes: number;
  location?: string;
  /** ISO-8601 candidate start times. */
  times: string[];
  votingMode?: "public" | "invited";
  inviteeEmails?: string[];
  /** Optional host-written note shown to voters on the poll page and included in
   * email invitations - useful when sharing the public link without emails. */
  message?: string;
}

export function normalizeInviteeEmails(emails: string[]): string[] {
  return [
    ...new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    ),
  ];
}

export function resolvePollVoter(
  votingMode: string,
  invitees: { email: string; token: string }[],
  inviteToken: string | undefined,
  voter: { name: string; email: string },
): { name: string; email: string } {
  const name = voter.name.trim();
  const invitee =
    votingMode === "invited" ? invitees.find((row) => row.token === inviteToken) : undefined;
  if (votingMode === "invited" && !invitee) {
    throw new PollError("Use the personal voting link from your invitation email.", 403);
  }
  const email = invitee?.email ?? voter.email.trim().toLowerCase();
  if (!name || !email.includes("@")) throw new PollError("Enter your name and email.", 400);
  return { name, email };
}

/** Create a poll with its candidate times and send recipient-specific voting
 * links when it is invitation-only. */
export async function createPoll(
  hostId: string,
  input: CreatePollInput,
): Promise<{ token: string; id: string; invitedCount: number; emailFailures: number }> {
  const times = [...new Set(input.times)]
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now());
  if (times.length < 2) throw new PollError("Add at least two future time options.", 400);
  if (times.length > 20) throw new PollError("A poll can have at most 20 options.", 400);

  const votingMode = input.votingMode === "invited" ? "invited" : "public";
  const inviteeEmails = normalizeInviteeEmails(input.inviteeEmails ?? []);
  if (votingMode === "invited" && inviteeEmails.length === 0) {
    throw new PollError("Add at least one email recipient.", 400);
  }
  if (inviteeEmails.length > 100) {
    throw new PollError("A poll can invite at most 100 people.", 400);
  }

  const token = randomBytes(12).toString("base64url");
  const db = getDb();
  const result = await db.transaction(async (tx) => {
    const [poll] = await tx
      .insert(schema.meetingPolls)
      .values({
        hostId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        inviteMessage: input.message?.trim() || null,
        durationMinutes: String(input.durationMinutes),
        location: input.location?.trim() || null,
        token,
        votingMode,
        status: "open",
      })
      .returning();
    if (!poll) throw new PollError("Could not create poll", 500);

    await tx
      .insert(schema.pollOptions)
      .values(
        times
          .sort((a, b) => a.getTime() - b.getTime())
          .map((startsAt) => ({ pollId: poll.id, startsAt })),
      );
    const invitees =
      votingMode === "invited"
        ? await tx
            .insert(schema.pollInvitees)
            .values(
              inviteeEmails.map((email) => ({
                pollId: poll.id,
                email,
                token: randomBytes(18).toString("base64url"),
              })),
            )
            .returning()
        : [];
    return { poll, invitees };
  });

  let emailFailures = 0;
  if (result.invitees.length > 0) {
    const host = await db.query.users.findFirst({
      where: eq(schema.users.id, hostId),
      columns: { name: true },
    });
    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const sentIds: string[] = [];
    const deliveries = await Promise.allSettled(
      result.invitees.map(async (invitee) => {
        const voteUrl = `${appUrl}/poll/${token}?invite=${encodeURIComponent(invitee.token)}`;
        await sendEmail({
          to: invitee.email,
          ...pollInvitation({
            pollTitle: result.poll.title,
            hostName: host?.name ?? "A DayOtter user",
            voteUrl,
            optionCount: times.length,
            message: result.poll.inviteMessage ?? undefined,
          }),
        });
        sentIds.push(invitee.id);
      }),
    );
    emailFailures = deliveries.filter((delivery) => delivery.status === "rejected").length;
    if (sentIds.length > 0) {
      await db
        .update(schema.pollInvitees)
        .set({ sentAt: new Date() })
        .where(inArray(schema.pollInvitees.id, sentIds));
    }
    if (emailFailures > 0) {
      logger.error("poll invitation email failed", {
        event: "poll_invitation_email_failed",
        pollId: result.poll.id,
        failed: emailFailures,
      });
    }
  }

  return {
    token,
    id: result.poll.id,
    invitedCount: result.invitees.length,
    emailFailures,
  };
}

/** The public voting view (open polls) or a read-only finalized view. */
export async function getPollByToken(token: string, inviteToken?: string) {
  const poll = await getDb().query.meetingPolls.findFirst({
    where: eq(schema.meetingPolls.token, token),
    with: {
      options: { orderBy: asc(schema.pollOptions.startsAt) },
      votes: true,
      invitees: true,
      host: { columns: { name: true } },
    },
  });
  if (!poll) return undefined;
  const currentInvite =
    poll.votingMode === "invited"
      ? poll.invitees.find((invitee) => invitee.token === inviteToken)
      : undefined;
  if (poll.votingMode === "invited" && !currentInvite) return undefined;
  return { ...poll, currentInvite };
}

/** The host's results view - same shape, fetched by id + ownership check. */
export async function getPollForHost(pollId: string, hostId: string) {
  const poll = await getDb().query.meetingPolls.findFirst({
    where: and(eq(schema.meetingPolls.id, pollId), eq(schema.meetingPolls.hostId, hostId)),
    with: {
      options: { orderBy: asc(schema.pollOptions.startsAt) },
      votes: true,
      invitees: true,
      host: { columns: { name: true } },
    },
  });
  return poll ?? null;
}

/** List a host's polls (newest first) with lightweight counts. */
/** Delete a poll (ownership-checked). Options + votes cascade. */
export async function deletePoll(pollId: string, hostId: string): Promise<boolean> {
  const rows = await getDb()
    .delete(schema.meetingPolls)
    .where(and(eq(schema.meetingPolls.id, pollId), eq(schema.meetingPolls.hostId, hostId)))
    .returning({ id: schema.meetingPolls.id });
  return rows.length > 0;
}

export async function listPolls(hostId: string) {
  return getDb().query.meetingPolls.findMany({
    where: eq(schema.meetingPolls.hostId, hostId),
    orderBy: (p, { desc }) => desc(p.createdAt),
    with: {
      options: { columns: { id: true } },
      votes: { columns: { id: true, voterEmail: true } },
      invitees: { columns: { id: true, email: true } },
    },
  });
}

/**
 * Record a voter's responses (one per option). Idempotent per (option, email):
 * re-voting overwrites the previous response, so a voter can change their mind.
 */
export async function submitVotes(
  token: string,
  voter: { name: string; email: string },
  responses: { optionId: string; response: string }[],
  inviteToken?: string,
): Promise<void> {
  const db = getDb();
  const poll = await db.query.meetingPolls.findFirst({
    where: eq(schema.meetingPolls.token, token),
    with: {
      options: { columns: { id: true, startsAt: true } },
      invitees: true,
      host: { columns: { email: true, name: true, timezone: true } },
    },
  });
  if (!poll) throw new PollError("Poll not found", 404);
  if (poll.status !== "open") throw new PollError("This poll is closed.", 409);

  const validOptionIds = new Set(poll.options.map((o) => o.id));
  const { name, email } = resolvePollVoter(poll.votingMode, poll.invitees, inviteToken, voter);

  const clean = responses.filter(
    (r) => validOptionIds.has(r.optionId) && VOTE_RESPONSES.has(r.response),
  );
  if (clean.length === 0) throw new PollError("Pick your availability for at least one time.", 400);

  for (const r of clean) {
    await db
      .insert(schema.pollVotes)
      .values({
        pollId: poll.id,
        optionId: r.optionId,
        voterName: name,
        voterEmail: email,
        response: r.response,
      })
      .onConflictDoUpdate({
        target: [schema.pollVotes.optionId, schema.pollVotes.voterEmail],
        set: { response: r.response, voterName: name },
      });
  }

  if (poll.host?.email) {
    const votes = await db.query.pollVotes.findMany({
      where: eq(schema.pollVotes.pollId, poll.id),
      columns: { optionId: true, voterEmail: true, response: true },
    });
    const voterEmails = new Set(votes.map((vote) => vote.voterEmail.toLowerCase()));
    const participationLabel =
      poll.votingMode === "invited"
        ? `${poll.invitees.filter((invitee) => voterEmails.has(invitee.email.toLowerCase())).length} of ${poll.invitees.length} invited recipients have voted`
        : `${voterEmails.size} ${voterEmails.size === 1 ? "person has" : "people have"} voted`;
    const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    await sendEmail({
      to: poll.host.email,
      ...pollVoteUpdate({
        pollTitle: poll.title,
        voterName: name,
        voterEmail: email,
        participationLabel,
        resultsUrl: `${appUrl}/polls/${poll.id}`,
        timezone: poll.host.timezone ?? "UTC",
        options: poll.options.map((option) => {
          const optionVotes = votes.filter((vote) => vote.optionId === option.id);
          return {
            startsAt: option.startsAt,
            yes: optionVotes.filter((vote) => vote.response === "yes").length,
            maybe: optionVotes.filter((vote) => vote.response === "maybe").length,
            no: optionVotes.filter((vote) => vote.response === "no").length,
          };
        }),
      }),
    }).catch((err) =>
      logger.error("poll vote notification failed", {
        event: "poll_vote_notification_failed",
        pollId: poll.id,
        err,
      }),
    );
  }
}

/**
 * Finalize a poll on the winning option: mark it finalized, add the event to the
 * host's calendar (inviting everyone who could make it), and email the host plus
 * all yes/maybe voters that the time is set. Standalone from the booking table -
 * the poll IS the record - so it doesn't need an event type.
 */
export async function finalizePoll(
  pollId: string,
  hostId: string,
  optionId: string,
  message?: string,
): Promise<void> {
  const db = getDb();
  const poll = await db.query.meetingPolls.findFirst({
    where: and(eq(schema.meetingPolls.id, pollId), eq(schema.meetingPolls.hostId, hostId)),
    with: { options: true, votes: true, host: true },
  });
  if (!poll) throw new PollError("Poll not found", 404);
  if (poll.status === "finalized") throw new PollError("This poll is already finalized.", 409);

  const option = poll.options.find((o) => o.id === optionId);
  if (!option) throw new PollError("That time option doesn't exist.", 400);

  const duration = Number(poll.durationMinutes) || 30;
  const start = option.startsAt;
  const end = new Date(start.getTime() + duration * 60_000);

  // Polls store the location as a TYPE slug (google_meet, zoom, ...), not a place.
  // Map it to something a calendar invite can show; auto-conference types carry
  // their own generated link, so the event location stays empty for those.
  const createConference = poll.location
    ? AUTO_CONFERENCE.includes(poll.location as (typeof AUTO_CONFERENCE)[number])
    : false;
  const locationLabel = poll.location
    ? (LOCATION_LABELS[poll.location as keyof typeof LOCATION_LABELS] ?? poll.location)
    : undefined;

  // Finalize first: the calendar write below is best-effort, so the poll must be
  // marked locked-in regardless of whether the host has a connected calendar.
  await db
    .update(schema.meetingPolls)
    .set({ status: "finalized", finalizedOptionId: optionId })
    .where(eq(schema.meetingPolls.id, pollId));

  // Everyone who said yes/maybe to the winning time (dedup by email).
  const attendeesByEmail = new Map<string, { email: string; name: string }>();
  for (const v of poll.votes) {
    if (v.optionId === optionId && (v.response === "yes" || v.response === "maybe")) {
      attendeesByEmail.set(v.voterEmail, { email: v.voterEmail, name: v.voterName });
    }
  }
  const attendees = [...attendeesByEmail.values()];

  // Add to the host's calendar (best-effort), inviting the confirmed guests. The
  // event carries the host's meeting details (Zoom link etc.) in the description
  // so the provider's own invite email is useful - the {details} placeholder is
  // filled with the location label because the generated link isn't known yet.
  const calendarMessage = applyCalendarMessage(message, locationLabel);
  const description = [poll.description, calendarMessage].filter(Boolean).join("\n\n");
  let meetingUrl: string | undefined;
  try {
    const written = await writeBookingToCalendar(hostId, {
      title: poll.title,
      description,
      start,
      end,
      timezone: poll.host?.timezone ?? "UTC",
      attendees,
      location: createConference ? undefined : locationLabel,
      createConference,
    });
    meetingUrl = written?.meetingUrl;
  } catch (err) {
    logger.error("poll finalize calendar write failed", {
      event: "poll_calendar_failed",
      pollId,
      err,
    });
  }

  // Host-written meeting details go out with the confirmation emails; the
  // `{details}` placeholder is filled with the generated conference URL (if any).
  const finalizeMessage = applyFinalizeMessage(message, meetingUrl);
  if (finalizeMessage) {
    await db
      .update(schema.meetingPolls)
      .set({ finalizeMessage })
      .where(eq(schema.meetingPolls.id, pollId));
  }

  // Confirm the time to the host + everyone who's coming.
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const recipients = [
    ...(poll.host?.email
      ? [{ email: poll.host.email, name: poll.host.name ?? "you", tz: poll.host.timezone }]
      : []),
    ...attendees.map((a) => ({ email: a.email, name: a.name, tz: poll.host?.timezone ?? "UTC" })),
  ];
  await Promise.all(
    recipients.map((r) =>
      sendEmail({
        ...bookingConfirmation({
          eventTitle: poll.title,
          start,
          end,
          timezone: r.tz ?? "UTC",
          hostName: poll.host?.name ?? "your host",
          attendeeName: r.name,
          location: locationLabel,
          meetingUrl,
          manageUrl: `${appUrl}/poll/${poll.token}`,
          message: finalizeMessage,
          // The host locked in the time; everyone who can make it is listed
          // (minus the recipient, so nobody reads "Also attending: yourself").
          booker: poll.host?.email
            ? { name: poll.host.name ?? undefined, email: poll.host.email }
            : undefined,
          addedAttendees: attendees
            .filter((a) => a.email.toLowerCase() !== r.email.toLowerCase())
            .map((a) => ({ name: a.name, email: a.email })),
        }),
        to: r.email,
      }),
    ),
  ).catch((err) =>
    logger.error("poll finalize email failed", { event: "poll_email_failed", pollId, err }),
  );
}
