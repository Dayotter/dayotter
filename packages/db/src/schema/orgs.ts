import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { membershipRole, timestamps } from "./_shared";

/**
 * Tenant boundary. Every row in the system ultimately belongs to an org.
 * Also the Better Auth `organization` model (see schema/auth.ts + packages/auth).
 */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  ...timestamps,
});

/** The Better Auth `user` model, extended with calSync fields (handle, timezone). */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name"),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** Public booking handle, e.g. /archit -> resolves to this user. */
    handle: text("handle").unique(),
    timezone: text("timezone").notNull().default("UTC"),
    ...timestamps,
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

/** Join table: which users belong to which orgs, and with what role. */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: membershipRole("role").notNull().default("member"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("memberships_org_user_idx").on(t.organizationId, t.userId),
    index("memberships_user_idx").on(t.userId),
  ],
);

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [memberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));
