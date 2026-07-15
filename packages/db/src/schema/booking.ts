import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { bookingStatus, calendarProvider, paymentStatus, timestamps } from "./_shared";
import { calendars } from "./calendar";
import { organizations, users } from "./orgs";
import { eventTypes } from "./scheduling";

/** A scheduled meeting instance. */
export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "restrict" }),
    /** The org member who hosts this booking (assigned for round-robin). */
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** Booker's timezone as selected on the booking page. */
    timezone: text("timezone").notNull(),
    status: bookingStatus("status").notNull().default("confirmed"),

    location: text("location"),
    meetingUrl: text("meeting_url"),

    /** Answers to the event type's intake questions. */
    responses: jsonb("responses").$type<Record<string, unknown>>(),
    /** Stable public token used in reschedule/cancel links. */
    uid: text("uid").notNull(),
    /** Shared across the occurrences of a recurring booking (null for one-offs). */
    recurrenceUid: text("recurrence_uid"),

    /** True for bookings on a group event type (capacity > 1). These share a
     * slot, so they're EXEMPT from the per-host single-slot / no-overlap guards
     * below; capacity is instead enforced transactionally in createBooking. */
    isGroup: boolean("is_group").notNull().default(false),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),

    // Payments (Stripe). paymentStatus="none" for free event types.
    paymentStatus: paymentStatus("payment_status").notNull().default("none"),
    /** Stripe PaymentIntent id - used to issue refunds on cancel. */
    paymentIntentId: text("payment_intent_id"),
    /** Amount actually charged, in the currency's minor units (cents). */
    amountPaid: integer("amount_paid"),
    paymentCurrency: text("payment_currency"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("bookings_uid_idx").on(t.uid),
    index("bookings_host_idx").on(t.hostId),
    index("bookings_org_idx").on(t.organizationId),
    index("bookings_starts_idx").on(t.startsAt),
    // Serves the daily/weekly-cap and group-capacity counts on the (synchronous)
    // booking-creation path, and the analytics group-by, which all filter
    // event_type_id + a starts_at range.
    index("bookings_event_starts_idx").on(t.eventTypeId, t.startsAt),
    // Prevent a check-then-insert race from creating two confirmed bookings for
    // the same host at the same instant. Enforced only for live bookings so a
    // cancelled slot can be re-booked. NB: a stronger GiST EXCLUSION constraint
    // (`bookings_no_overlap`, migration 0019) additionally rejects cross-duration
    // OVERLAPS - it can't be expressed in the drizzle DSL, so it lives in raw SQL.
    uniqueIndex("bookings_host_slot_active_idx")
      .on(t.hostId, t.startsAt)
      .where(sql`${t.status} = 'confirmed' AND ${t.isGroup} = false`),
  ],
);

/** Attendees on a booking (invitee + any guests). */
export const bookingAttendees = pgTable(
  "booking_attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    timezone: text("timezone"),
    ...timestamps,
  },
  (t) => [index("booking_attendees_booking_idx").on(t.bookingId)],
);

/**
 * Links a booking to the event we created on a provider's calendar, so we can
 * update/delete it on reschedule/cancel and reconcile two-way changes.
 */
export const bookingReferences = pgTable(
  "booking_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    provider: calendarProvider("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("booking_refs_provider_event_idx").on(t.provider, t.externalEventId),
    index("booking_refs_booking_idx").on(t.bookingId),
  ],
);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bookings.organizationId],
    references: [organizations.id],
  }),
  eventType: one(eventTypes, { fields: [bookings.eventTypeId], references: [eventTypes.id] }),
  host: one(users, { fields: [bookings.hostId], references: [users.id] }),
  attendees: many(bookingAttendees),
  references: many(bookingReferences),
}));

export const bookingAttendeesRelations = relations(bookingAttendees, ({ one }) => ({
  booking: one(bookings, { fields: [bookingAttendees.bookingId], references: [bookings.id] }),
}));

export const bookingReferencesRelations = relations(bookingReferences, ({ one }) => ({
  booking: one(bookings, { fields: [bookingReferences.bookingId], references: [bookings.id] }),
  calendar: one(calendars, { fields: [bookingReferences.calendarId], references: [calendars.id] }),
}));
