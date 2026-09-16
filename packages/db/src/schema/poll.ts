import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * A group scheduling poll ("find a time"): the host proposes several candidate
 * times, collects votes through a public link or recipient-specific email
 * invitations, and finalizes the winner into a real booking. Standalone from
 * event types - the host sets title, duration and location directly.
 */
export const meetingPolls = pgTable(
  "meeting_polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Optional host-written note shown to voters on the poll page and included in
     * invitation emails - useful when the host shares the public link themselves. */
    inviteMessage: text("invite_message"),
    /** Optional host-written note (meeting details like a Zoom link) sent with the
     * booking-confirmation emails when the poll is finalized. */
    finalizeMessage: text("finalize_message"),
    durationMinutes: text("duration_minutes").notNull().default("30"),
    location: text("location"),
    /** Opaque public token used in the /poll/<token> voting URL. */
    token: text("token").notNull(),
    /** public = anyone with the link; invited = only recipient-specific links. */
    votingMode: text("voting_mode").notNull().default("public"),
    /** open → accepting votes, finalized → a time was picked, closed → cancelled. */
    status: text("status").notNull().default("open"),
    /** The option the host picked when finalizing. */
    finalizedOptionId: uuid("finalized_option_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("meeting_polls_token_idx").on(t.token),
    index("meeting_polls_host_idx").on(t.hostId),
  ],
);

/** A candidate time on a poll. */
export const pollOptions = pgTable(
  "poll_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => meetingPolls.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("poll_options_poll_idx").on(t.pollId)],
);

/**
 * One voter's response to one option. A voter (identified by email) has at most
 * one vote per option - re-voting updates the response.
 */
export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => meetingPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    voterName: text("voter_name").notNull(),
    voterEmail: text("voter_email").notNull(),
    /** yes | no | maybe */
    response: text("response").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("poll_votes_option_voter_idx").on(t.optionId, t.voterEmail),
    index("poll_votes_poll_idx").on(t.pollId),
  ],
);

/** A recipient allowed to vote in an email-only poll. Each recipient gets a
 * unique token so the server, rather than a self-entered email field, identifies
 * whose response was submitted. */
export const pollInvitees = pgTable(
  "poll_invitees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => meetingPolls.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("poll_invitees_poll_email_idx").on(t.pollId, t.email),
    uniqueIndex("poll_invitees_token_idx").on(t.token),
    index("poll_invitees_poll_idx").on(t.pollId),
  ],
);

export const meetingPollsRelations = relations(meetingPolls, ({ one, many }) => ({
  host: one(users, { fields: [meetingPolls.hostId], references: [users.id] }),
  options: many(pollOptions),
  votes: many(pollVotes),
  invitees: many(pollInvitees),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(meetingPolls, { fields: [pollOptions.pollId], references: [meetingPolls.id] }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(meetingPolls, { fields: [pollVotes.pollId], references: [meetingPolls.id] }),
  option: one(pollOptions, { fields: [pollVotes.optionId], references: [pollOptions.id] }),
}));

export const pollInviteesRelations = relations(pollInvitees, ({ one }) => ({
  poll: one(meetingPolls, { fields: [pollInvitees.pollId], references: [meetingPolls.id] }),
}));

/**
 * A named, reusable meeting-details message a host can save and pick from when
 * finalizing a poll - so a link that never changes (a Zoom URL, address, ...) is
 * entered once. `isDefault` marks the one pre-filled in the finalize dialog.
 */
export const pollMessageTemplates = pgTable(
  "poll_message_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    body: text("body").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index("poll_message_templates_user_idx").on(t.userId),
    uniqueIndex("poll_message_templates_user_name_idx").on(t.userId, t.name),
  ],
);

export const pollMessageTemplatesRelations = relations(pollMessageTemplates, ({ one }) => ({
  user: one(users, { fields: [pollMessageTemplates.userId], references: [users.id] }),
}));
