import { relations } from "drizzle-orm";
import { index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { connectionStatus, timestamps } from "./_shared";
import { bookings } from "./booking";
import { users } from "./orgs";

/**
 * A connected CRM account (Salesforce / HubSpot). Like `conferencing_connections`,
 * `provider` is plain text (no enum migration to add another CRM), and
 * `credentials` is an AES-256-GCM-encrypted JSON blob of the OAuth tokens.
 * When a booking is created/rescheduled/cancelled, the worker pushes a contact +
 * meeting activity to every active connection the host holds.
 */
export const crmConnections = pgTable(
  "crm_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** "salesforce" | "hubspot" (plain text - new CRMs need no enum migration). */
    provider: text("provider").notNull(),
    /** The connected account/portal id (HubSpot hub id, Salesforce org id). */
    externalAccountId: text("external_account_id").notNull(),
    /** Human label for the settings UI (portal domain / instance URL). */
    accountLabel: text("account_label"),
    credentials: text("credentials").notNull(),
    status: connectionStatus("status").notNull().default("active"),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("crm_user_provider_idx").on(t.userId, t.provider),
    index("crm_user_idx").on(t.userId),
  ],
);

/**
 * Links a booking to the records we created in a CRM connection, so a reschedule
 * updates (rather than duplicates) the same activity and a cancel closes it.
 * One row per (booking, connection).
 */
export const crmReferences = pgTable(
  "crm_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => crmConnections.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    /** External contact id created/matched for the attendee. */
    externalContactId: text("external_contact_id"),
    /** External activity id (HubSpot meeting / Salesforce Event) for the booking. */
    externalActivityId: text("external_activity_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("crm_ref_booking_conn_idx").on(t.bookingId, t.connectionId),
    index("crm_ref_booking_idx").on(t.bookingId),
  ],
);

export const crmConnectionsRelations = relations(crmConnections, ({ one, many }) => ({
  user: one(users, { fields: [crmConnections.userId], references: [users.id] }),
  references: many(crmReferences),
}));

export const crmReferencesRelations = relations(crmReferences, ({ one }) => ({
  booking: one(bookings, { fields: [crmReferences.bookingId], references: [bookings.id] }),
  connection: one(crmConnections, {
    fields: [crmReferences.connectionId],
    references: [crmConnections.id],
  }),
}));
