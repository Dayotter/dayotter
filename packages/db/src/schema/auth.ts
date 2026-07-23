import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations, users } from "./orgs";

/**
 * Better Auth identity tables. Property names match Better Auth's expected field
 * names (camelCase); the Drizzle adapter maps them via the schema mapping in
 * packages/auth. IDs are DB-generated UUIDs (Better Auth `generateId: false`).
 */

/** Better Auth `session` (extended with active org/team by the organization plugin). */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id").references(() => organizations.id, {
      onDelete: "set null",
    }),
    /** No FK: teams live in team.ts and this is set opportunistically by the plugin. */
    activeTeamId: uuid("active_team_id"),
    ...timestamps,
  },
  (t) => [uniqueIndex("sessions_token_idx").on(t.token), index("sessions_user_idx").on(t.userId)],
);

/** Better Auth `account`: a login credential/provider link (NOT calendar connections). */
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_idx").on(t.userId)],
);

/** Better Auth `verification`: email verification / password reset tokens. */
export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** Better Auth organization-plugin `invitation`. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").notNull().default("pending"),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("invitations_org_idx").on(t.organizationId)],
);

/**
 * Better Auth twoFactor-plugin `twoFactor`: the user's TOTP secret + backup
 * codes. One row per user with 2FA set up (see `users.twoFactorEnabled`). The
 * plugin manages these; we only provide the table.
 */
export const twoFactors = pgTable(
  "two_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Base32 TOTP secret. */
    secret: text("secret").notNull(),
    /** Encoded one-time backup/recovery codes. */
    backupCodes: text("backup_codes").notNull(),
    // Remaining fields are managed by the Better Auth twoFactor plugin
    // (field names/types mirror its schema; see plugins/two-factor/schema).
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    /** Set when repeated failures temporarily lock verification. */
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("two_factors_user_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const twoFactorsRelations = relations(twoFactors, ({ one }) => ({
  user: one(users, { fields: [twoFactors.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));
