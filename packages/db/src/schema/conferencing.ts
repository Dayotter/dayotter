import { relations } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { connectionStatus, timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * A connected video-conferencing account (currently Zoom). Separate from
 * `calendar_connections` - conferencing isn't a calendar. `credentials` is an
 * encrypted JSON blob of the OAuth tokens (AES-256-GCM), same as calendars.
 * When a booking's event type uses that provider's location, we create a real
 * meeting on the fly and use its join URL.
 */
export const conferencingConnections = pgTable(
  "conferencing_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "zoom" (room to add "google_meet"/etc. later without an enum migration). */
    provider: text("provider").notNull().default("zoom"),
    externalAccountId: text("external_account_id").notNull(),
    credentials: text("credentials").notNull(),
    status: connectionStatus("status").notNull().default("active"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("conferencing_user_provider_idx").on(t.userId, t.provider),
    index("conferencing_user_idx").on(t.userId),
  ],
);

export const conferencingConnectionsRelations = relations(conferencingConnections, ({ one }) => ({
  user: one(users, { fields: [conferencingConnections.userId], references: [users.id] }),
}));
