import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { calendarProvider, connectionStatus, timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * A connected external account (one Google/Microsoft/Apple login).
 * OAuth tokens are stored encrypted (see @dayotter/core crypto) in `credentials`.
 */
export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: calendarProvider("provider").notNull(),
    /** Provider-side account identifier (email or account id). */
    externalAccountId: text("external_account_id").notNull(),
    /** Encrypted JSON blob: { accessToken, refreshToken, expiresAt, ... }. */
    credentials: text("credentials").notNull(),
    status: connectionStatus("status").notNull().default("active"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastError: text("last_error"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("connections_user_provider_account_idx").on(
      t.userId,
      t.provider,
      t.externalAccountId,
    ),
    index("connections_user_idx").on(t.userId),
  ],
);

/** An individual calendar inside a connection (e.g. "Work", "Personal", "Holidays"). */
export const calendars = pgTable(
  "calendars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => calendarConnections.id, { onDelete: "cascade" }),
    /** Provider-side calendar id. */
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    color: text("color"),
    timezone: text("timezone"),
    /** Is this calendar checked for busy times when computing availability? */
    checkForConflicts: boolean("check_for_conflicts").notNull().default(true),
    /** Is this the calendar that new bookings get written to? */
    isTargetForBookings: boolean("is_target_for_bookings").notNull().default(false),
    /** Read-only source (ICS feed, or a calendar the user can't write): never a booking target. */
    isReadOnly: boolean("is_read_only").notNull().default(false),
    /** Hidden from the calendar list UI (still syncs if checkForConflicts). */
    isHidden: boolean("is_hidden").notNull().default(false),
    /** Incremental-sync cursor: Google syncToken / MS deltaLink / CalDAV ctag. */
    syncToken: text("sync_token"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("calendars_connection_external_idx").on(t.connectionId, t.externalId),
    index("calendars_connection_idx").on(t.connectionId),
  ],
);

/**
 * Push-notification subscriptions so we get real-time change events.
 * Google `watch` channels expire ~7d, MS Graph subscriptions ~3d - a renewal
 * job re-subscribes before `expiresAt`. Apple/CalDAV has none (poll instead).
 */
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    /** Provider-side subscription/channel id used to correlate incoming webhooks. */
    externalId: text("external_id").notNull(),
    /** Provider extras (resourceId, clientState, etc.). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("webhook_subs_external_idx").on(t.externalId),
    index("webhook_subs_calendar_idx").on(t.calendarId),
    index("webhook_subs_expires_idx").on(t.expiresAt),
  ],
);

/**
 * Denormalized free/busy cache. We keep external busy blocks here so the
 * availability engine reads from Postgres instead of hitting provider APIs
 * on every booking-page load.
 */
export const busyBlocks = pgTable(
  "busy_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [
    index("busy_blocks_calendar_idx").on(t.calendarId),
    index("busy_blocks_range_idx").on(t.calendarId, t.startsAt, t.endsAt),
    // Enables per-event upsert during incremental sync.
    uniqueIndex("busy_blocks_calendar_event_idx").on(t.calendarId, t.externalEventId),
  ],
);

/** One external attendee on a synced event. */
export type SyncedAttendee = { email: string; name?: string; responseStatus?: string };

/**
 * The unified full event model - the single source of truth for external
 * calendar data. Every provider maps into this shape. `busy_blocks` above is a
 * lean availability-only projection of this table (written in the same sync pass).
 */
export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    calendarId: uuid("calendar_id")
      .notNull()
      .references(() => calendars.id, { onDelete: "cascade" }),
    externalEventId: text("external_event_id").notNull(),

    title: text("title"),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    allDay: boolean("all_day").notNull().default(false),
    timezone: text("timezone"),

    location: text("location"),
    meetingUrl: text("meeting_url"),
    organizerEmail: text("organizer_email"),
    organizerName: text("organizer_name"),
    attendees: jsonb("attendees").$type<SyncedAttendee[]>(),

    /** confirmed | tentative | cancelled */
    status: text("status"),
    /** default | public | private */
    visibility: text("visibility"),
    /** opaque (counts as busy) | transparent (free) */
    transparency: text("transparency"),
    /** Series id linking recurring instances; set on recurring events. */
    recurringEventId: text("recurring_event_id"),
    isRecurring: boolean("is_recurring").notNull().default(false),

    /** Provider-specific extras that don't map to a column. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("calendar_events_calendar_event_idx").on(t.calendarId, t.externalEventId),
    index("calendar_events_calendar_range_idx").on(t.calendarId, t.startsAt, t.endsAt),
    index("calendar_events_series_idx").on(t.recurringEventId),
  ],
);

export const calendarConnectionsRelations = relations(calendarConnections, ({ one, many }) => ({
  user: one(users, { fields: [calendarConnections.userId], references: [users.id] }),
  calendars: many(calendars),
}));

export const calendarEventsRelations = relations(calendarEvents, ({ one }) => ({
  calendar: one(calendars, { fields: [calendarEvents.calendarId], references: [calendars.id] }),
}));

export const calendarsRelations = relations(calendars, ({ one, many }) => ({
  connection: one(calendarConnections, {
    fields: [calendars.connectionId],
    references: [calendarConnections.id],
  }),
  webhookSubscriptions: many(webhookSubscriptions),
  busyBlocks: many(busyBlocks),
  events: many(calendarEvents),
}));
