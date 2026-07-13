import { randomBytes } from "node:crypto";
import { logger } from "@dayotter/core";
import { and, asc, eq, getDb, schema } from "@dayotter/db";
import { bookingConfirmation, sendEmail } from "@dayotter/emails";
import { AUTO_CONFERENCE } from "../booking/event-type-input";
import { writeBookingToCalendar } from "../calendar/host-calendar";

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
}

/** Create a poll with its candidate times; returns the public token. */
export async function createPoll(
  hostId: string,
  input: CreatePollInput,
): Promise<{ token: string; id: string }> {
  const times = [...new Set(input.times)]
    .map((t) => new Date(t))
    .filter((d) => !Number.isNaN(d.getTime()) && d.getTime() > Date.now());
  if (times.length < 2) throw new PollError("Add at least two future time options.", 400);
  if (times.length > 20) throw new PollError("A poll can have at most 20 options.", 400);

  const token = randomBytes(12).toString("base64url");
  const db = getDb();
  const [poll] = await db
    .insert(schema.meetingPolls)
    .values({
      hostId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      durationMinutes: String(input.durationMinutes),
      location: input.location?.trim() || null,
      token,
      status: "open",
    })
    .returning();
  if (!poll) throw new PollError("Could not create poll", 500);

  await db
    .insert(schema.pollOptions)
    .values(
      times
        .sort((a, b) => a.getTime() - b.getTime())
        .map((startsAt) => ({ pollId: poll.id, startsAt })),
    );
  return { token, id: poll.id };
}

/** The public voting view (open polls) or a read-only finalized view. */
export async function getPollByToken(token: string) {
  return getDb().query.meetingPolls.findFirst({
    where: eq(schema.meetingPolls.token, token),
    with: {
      options: { orderBy: asc(schema.pollOptions.startsAt) },
      votes: true,
      host: { columns: { name: true } },
    },
  });
}

/** The host's results view — same shape, fetched by id + ownership check. */
export async function getPollForHost(pollId: string, hostId: string) {
  const poll = await getDb().query.meetingPolls.findFirst({
    where: and(eq(schema.meetingPolls.id, pollId), eq(schema.meetingPolls.hostId, hostId)),
    with: {
      options: { orderBy: asc(schema.pollOptions.startsAt) },
      votes: true,
      host: { columns: { name: true } },
    },
  });
  return poll ?? null;
}

/** List a host's polls (newest first) with lightweight counts. */
export async function listPolls(hostId: string) {
  return getDb().query.meetingPolls.findMany({
    where: eq(schema.meetingPolls.hostId, hostId),
    orderBy: (p, { desc }) => desc(p.createdAt),
    with: { options: { columns: { id: true } }, votes: { columns: { id: true } } },
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
): Promise<void> {
  const db = getDb();
  const poll = await db.query.meetingPolls.findFirst({
    where: eq(schema.meetingPolls.token, token),
    with: { options: { columns: { id: true } } },
  });
  if (!poll) throw new PollError("Poll not found", 404);
  if (poll.status !== "open") throw new PollError("This poll is closed.", 409);

  const validOptionIds = new Set(poll.options.map((o) => o.id));
  const email = voter.email.trim().toLowerCase();
  const name = voter.name.trim();
  if (!name || !email.includes("@")) throw new PollError("Enter your name and email.", 400);

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
}

/**
 * Finalize a poll on the winning option: mark it finalized, add the event to the
 * host's calendar (inviting everyone who could make it), and email the host plus
 * all yes/maybe voters that the time is set. Standalone from the booking table —
 * the poll IS the record — so it doesn't need an event type.
 */
export async function finalizePoll(
  pollId: string,
  hostId: string,
  optionId: string,
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

  // Add to the host's calendar (best-effort), inviting the confirmed guests.
  let meetingUrl: string | undefined;
  try {
    const written = await writeBookingToCalendar(hostId, {
      title: poll.title,
      description: poll.description ?? undefined,
      start,
      end,
      timezone: poll.host?.timezone ?? "UTC",
      attendees,
      location: poll.location ?? undefined,
      createConference: poll.location
        ? AUTO_CONFERENCE.includes(poll.location as (typeof AUTO_CONFERENCE)[number])
        : false,
    });
    meetingUrl = written?.meetingUrl;
  } catch (err) {
    logger.error("poll finalize calendar write failed", {
      event: "poll_calendar_failed",
      pollId,
      err,
    });
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
          location: poll.location ?? undefined,
          meetingUrl,
          manageUrl: `${appUrl}/poll/${poll.token}`,
        }),
        to: r.email,
      }),
    ),
  ).catch((err) =>
    logger.error("poll finalize email failed", { event: "poll_email_failed", pollId, err }),
  );
}
