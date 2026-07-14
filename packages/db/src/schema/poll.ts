import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * A group scheduling poll ("find a time"): the host proposes several candidate
 * times, shares a public link, invitees vote, and the host finalizes the winner
 * into a real booking. Standalone from event types - the host sets title,
 * duration and location directly.
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
    durationMinutes: text("duration_minutes").notNull().default("30"),
    location: text("location"),
    /** Opaque public token used in the /poll/<token> voting URL. */
    token: text("token").notNull(),
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

export const meetingPollsRelations = relations(meetingPolls, ({ one, many }) => ({
  host: one(users, { fields: [meetingPolls.hostId], references: [users.id] }),
  options: many(pollOptions),
  votes: many(pollVotes),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one, many }) => ({
  poll: one(meetingPolls, { fields: [pollOptions.pollId], references: [meetingPolls.id] }),
  votes: many(pollVotes),
}));

export const pollVotesRelations = relations(pollVotes, ({ one }) => ({
  poll: one(meetingPolls, { fields: [pollVotes.pollId], references: [meetingPolls.id] }),
  option: one(pollOptions, { fields: [pollVotes.optionId], references: [pollOptions.id] }),
}));
