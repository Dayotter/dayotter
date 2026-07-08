import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  time,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { locationType, schedulingType, timestamps } from "./_shared";
import { organizations, users } from "./orgs";

/** A named availability schedule (e.g. "Working hours", "Weekend calls"). */
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("Working hours"),
    timezone: text("timezone").notNull().default("UTC"),
    isDefault: boolean("is_default").notNull().default(false),
    ...timestamps,
  },
  (t) => [index("schedules_user_idx").on(t.userId)],
);

/** One recurring weekly window, e.g. Monday 09:00–17:00. dayOfWeek: 0=Sun..6=Sat. */
export const availabilityRules = pgTable(
  "availability_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    ...timestamps,
  },
  (t) => [index("availability_rules_schedule_idx").on(t.scheduleId)],
);

/** A one-off override for a specific date (holiday = unavailable, or custom hours). */
export const dateOverrides = pgTable(
  "date_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scheduleId: uuid("schedule_id")
      .notNull()
      .references(() => schedules.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    /** null start/end = fully unavailable that day. */
    startTime: time("start_time"),
    endTime: time("end_time"),
    ...timestamps,
  },
  (t) => [uniqueIndex("date_overrides_schedule_date_idx").on(t.scheduleId, t.date)],
);

/** A bookable meeting definition (Calendly "event type" / Cal.com "event type"). */
export const eventTypes = pgTable(
  "event_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Owner for individual types; null for team-owned types. */
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "cascade" }),
    /** Set for team-owned types (collective / round-robin). No FK to avoid an
     * import cycle with schema/team.ts; integrity enforced in the app. */
    teamId: uuid("team_id"),
    scheduleId: uuid("schedule_id").references(() => schedules.id, { onDelete: "set null" }),

    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    durationMinutes: integer("duration_minutes").notNull().default(30),
    schedulingType: schedulingType("scheduling_type").notNull().default("individual"),
    location: locationType("location").notNull().default("google_meet"),
    locationDetail: text("location_detail"),

    // Availability controls
    bufferBeforeMinutes: integer("buffer_before_minutes").notNull().default(0),
    bufferAfterMinutes: integer("buffer_after_minutes").notNull().default(0),
    minimumNoticeMinutes: integer("minimum_notice_minutes").notNull().default(60),
    slotIntervalMinutes: integer("slot_interval_minutes"),
    /** How far into the future bookings are allowed (null = unlimited). */
    bookingWindowDays: integer("booking_window_days").default(60),
    dailyBookingLimit: integer("daily_booking_limit"),

    // Intake form: array of { id, label, type, required }.
    questions: jsonb("questions").$type<BookingQuestion[]>().notNull().default([]),

    price: integer("price"), // in minor units (cents); null = free
    currency: text("currency"),

    isActive: boolean("is_active").notNull().default(true),
    isPrivate: boolean("is_private").notNull().default(false),
    color: text("color"),
    /** Where to send the booker after they book (null = the calSync confirmation). */
    redirectUrl: text("redirect_url"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("event_types_owner_slug_idx").on(t.ownerId, t.slug),
    index("event_types_org_idx").on(t.organizationId),
  ],
);

export type BookingQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "checkbox";
  required: boolean;
  options?: string[];
};

export const schedulesRelations = relations(schedules, ({ one, many }) => ({
  user: one(users, { fields: [schedules.userId], references: [users.id] }),
  availabilityRules: many(availabilityRules),
  dateOverrides: many(dateOverrides),
}));

export const availabilityRulesRelations = relations(availabilityRules, ({ one }) => ({
  schedule: one(schedules, {
    fields: [availabilityRules.scheduleId],
    references: [schedules.id],
  }),
}));

export const dateOverridesRelations = relations(dateOverrides, ({ one }) => ({
  schedule: one(schedules, { fields: [dateOverrides.scheduleId], references: [schedules.id] }),
}));

export const eventTypesRelations = relations(eventTypes, ({ one }) => ({
  organization: one(organizations, {
    fields: [eventTypes.organizationId],
    references: [organizations.id],
  }),
  owner: one(users, { fields: [eventTypes.ownerId], references: [users.id] }),
  schedule: one(schedules, { fields: [eventTypes.scheduleId], references: [schedules.id] }),
}));
