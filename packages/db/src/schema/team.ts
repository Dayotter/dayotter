import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { membershipRole, timestamps } from "./_shared";
import { organizations, users } from "./orgs";
import { eventTypes } from "./scheduling";

/** A group within an org used for collective / round-robin scheduling. */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("teams_org_slug_idx").on(t.organizationId, t.slug)],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Governs who may manage the team (add/remove members, create team event
     * types). Only owner/admin may; plain members are read-only participants. */
    role: membershipRole("role").notNull().default("member"),
    /** Round-robin weighting; higher = assigned more often. */
    priority: integer("priority").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("team_members_team_user_idx").on(t.teamId, t.userId),
    index("team_members_user_idx").on(t.userId),
  ],
);

/** Which members are hosts for a team-owned event type. */
export const eventTypeHosts = pgTable(
  "event_type_hosts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(1),
    ...timestamps,
  },
  (t) => [uniqueIndex("event_type_hosts_idx").on(t.eventTypeId, t.userId)],
);

/**
 * Team-wide scheduling rules that block bookable time for every member - the
 * "working agreements" layer. Two kinds:
 *  - `holiday`     - a whole day off (company holiday), given by `theDate`.
 *  - `no_meeting`  - a recurring weekly window (e.g. Friday afternoons), given
 *                    by `dayOfWeek` (0=Sun..6=Sat; null = every day) + the
 *                    `startMinute`/`endMinute` range (minutes from local midnight).
 * Applied in each member's schedule timezone by the availability engine.
 */
export const teamRules = pgTable(
  "team_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // 'holiday' | 'no_meeting'
    label: text("label"),
    theDate: date("the_date"),
    dayOfWeek: smallint("day_of_week"),
    startMinute: smallint("start_minute"),
    endMinute: smallint("end_minute"),
    ...timestamps,
  },
  (t) => [index("team_rules_team_idx").on(t.teamId)],
);

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  members: many(teamMembers),
  rules: many(teamRules),
}));

export const teamRulesRelations = relations(teamRules, ({ one }) => ({
  team: one(teams, { fields: [teamRules.teamId], references: [teams.id] }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));

export const eventTypeHostsRelations = relations(eventTypeHosts, ({ one }) => ({
  eventType: one(eventTypes, {
    fields: [eventTypeHosts.eventTypeId],
    references: [eventTypes.id],
  }),
  user: one(users, { fields: [eventTypeHosts.userId], references: [users.id] }),
}));
