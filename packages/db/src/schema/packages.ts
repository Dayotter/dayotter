import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations } from "./orgs";
import { eventTypes } from "./scheduling";

/**
 * A prepaid bundle a host sells against an event type — e.g. "5 coaching
 * sessions". Buying it grants the client a `package_credits` balance; each
 * booking of the event type spends one credit.
 */
export const sessionPackages = pgTable(
  "session_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Number of sessions the bundle grants. */
    sessionCount: integer("session_count").notNull(),
    /** Price for the whole bundle, in minor units (e.g. cents). */
    priceAmount: integer("price_amount").notNull(),
    currency: text("currency").notNull().default("usd"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("session_packages_event_type_idx").on(t.eventTypeId)],
);

/**
 * A client's remaining balance of credits against an event type. `usedCredits`
 * is incremented atomically as bookings are made; balance = total − used.
 */
export const packageCredits = pgTable(
  "package_credits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packageId: uuid("package_id").references(() => sessionPackages.id, { onDelete: "set null" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    /** The client this balance belongs to (matched on booking email). */
    clientEmail: text("client_email").notNull(),
    totalCredits: integer("total_credits").notNull(),
    usedCredits: integer("used_credits").notNull().default(0),
    /** Stripe payment intent that funded this grant — dedupes webhook retries. */
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    ...timestamps,
  },
  (t) => [
    index("package_credits_lookup_idx").on(t.eventTypeId, t.clientEmail),
    uniqueIndex("package_credits_pi_idx").on(t.stripePaymentIntentId),
  ],
);

export const sessionPackagesRelations = relations(sessionPackages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sessionPackages.organizationId],
    references: [organizations.id],
  }),
  eventType: one(eventTypes, {
    fields: [sessionPackages.eventTypeId],
    references: [eventTypes.id],
  }),
  credits: many(packageCredits),
}));

export const packageCreditsRelations = relations(packageCredits, ({ one }) => ({
  package: one(sessionPackages, {
    fields: [packageCredits.packageId],
    references: [sessionPackages.id],
  }),
  eventType: one(eventTypes, {
    fields: [packageCredits.eventTypeId],
    references: [eventTypes.id],
  }),
}));
