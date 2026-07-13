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
  timestamp,
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

/**
 * A first-class personal / focus time block (Planning Engine). Blocks the user's
 * bookable availability without needing an external calendar. kind: focus |
 * personal | travel | other.
 */
export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("focus"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    /** The booking that reserved this block (travel/prep/buffer), so it can be
     * removed on cancel and re-created on reschedule. Null = a manual block.
     * No hard FK (same convention as event_types.team_id) — cleanup is explicit. */
    bookingId: uuid("booking_id"),
    /** Shared id across the weekly occurrences of a recurring block, so the whole
     * series can be shown as one row and deleted together. Null = one-off. */
    seriesId: uuid("series_id"),
    ...timestamps,
  },
  (t) => [
    index("time_blocks_user_idx").on(t.userId, t.startsAt),
    index("time_blocks_booking_idx").on(t.bookingId),
    index("time_blocks_series_idx").on(t.seriesId),
  ],
);

/**
 * Automation rule (Automation Engine): when a booking matches, automatically
 * take an action — e.g. "every interview → 15-min prep block before". Composes
 * the Planning Engine (creates time_blocks). trigger is currently booking-created.
 */
export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    /** Case-insensitive substring the booking title must contain (null = any). */
    matchTitle: text("match_title"),
    /** When the rule fires: booking_created (default) | weekly (recurring). */
    trigger: text("trigger").notNull().default("booking_created"),
    /** prep_block (before) | buffer_after (after) | followup. Ignored for weekly. */
    action: text("action").notNull().default("prep_block"),
    /** Length of the created block, in minutes (booking-created triggers). */
    offsetMinutes: integer("offset_minutes").notNull().default(15),
    /** Title for the created block. */
    blockTitle: text("block_title"),
    /** Weekly trigger: day of week (0=Sun..6=Sat) the block recurs on. */
    dayOfWeek: smallint("day_of_week"),
    /** Weekly trigger: local block window as "HH:MM" strings. */
    windowStart: text("window_start"),
    windowEnd: text("window_end"),
    ...timestamps,
  },
  (t) => [index("automation_rules_user_idx").on(t.userId)],
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
    /** Minimum free time enforced around the host's own bookings (0 = none). */
    minimumGapMinutes: integer("minimum_gap_minutes").notNull().default(0),
    /** How far into the future bookings are allowed (null = unlimited). */
    bookingWindowDays: integer("booking_window_days").default(60),
    dailyBookingLimit: integer("daily_booking_limit"),
    /** Max confirmed bookings per host-local ISO week (null = unlimited). */
    weeklyBookingLimit: integer("weekly_booking_limit"),
    /** Group events: seats per slot. 1 = a normal 1:1 event; >1 = many bookers
     * share one slot until it fills. Only for individual (owner) event types. */
    maxAttendees: integer("max_attendees").notNull().default(1),
    /** Recurring meetings: how many occurrences one booking creates (1 = a normal
     * single meeting; >1 = a repeating series) and how far apart they sit. */
    recurringCount: integer("recurring_count").notNull().default(1),
    recurringFrequency: text("recurring_frequency").notNull().default("weekly"),
    /** SHA-256 of an access code required to book (null = public, no code). */
    accessCodeHash: text("access_code_hash"),
    /** If set + non-empty, the booker chooses one of these durations (minutes). */
    durationOptions: jsonb("duration_options").$type<number[]>(),

    // Intake form: array of { id, label, type, required }.
    questions: jsonb("questions").$type<BookingQuestion[]>().notNull().default([]),

    price: integer("price"), // in minor units (cents); null/0 = free
    currency: text("currency"),
    /** If set (< price), only this deposit is charged to book. Null = charge full price. */
    depositAmount: integer("deposit_amount"),

    isActive: boolean("is_active").notNull().default(true),
    isPrivate: boolean("is_private").notNull().default(false),
    color: text("color"),
    /** Where to send the booker after they book (null = the dayotter confirmation). */
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

/** Single-use / expiring booking links for an event type (Calendly "one-off links"). */
export const bookingLinks = pgTable(
  "booking_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    /** Opaque public token used in the /book/<token> URL. */
    token: text("token").notNull(),
    /** Optional expiry; null = never expires. */
    expiresAt: date("expires_at"),
    /** How many bookings the link allows (1 = single-use). */
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("booking_links_token_idx").on(t.token),
    index("booking_links_event_idx").on(t.eventTypeId),
  ],
);

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
