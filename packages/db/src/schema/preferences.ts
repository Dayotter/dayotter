import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { notificationChannelType, themePref, timeFormat, timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * Per-user preferences. Non-sensitive display prefs are plain columns (so we can
 * query/render them cheaply); anything sensitive or free-form lives in
 * `encryptedData` — an AES-256-GCM blob (see @calsync/core crypto). Decrypt only
 * where needed (e.g. the worker when composing a reminder).
 */
export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Non-sensitive display preferences.
    locale: text("locale").notNull().default("en"),
    timeFormat: timeFormat("time_format").notNull().default("12h"),
    /** 0 = Sunday .. 6 = Saturday. */
    weekStartsOn: smallint("week_starts_on").notNull().default(0),
    theme: themePref("theme").notNull().default("system"),
    /** Default reminder offsets in minutes before the event, e.g. [1440, 60]. */
    defaultReminderOffsets: jsonb("default_reminder_offsets")
      .$type<number[]>()
      .notNull()
      .default([1440, 60]),
    /** Auto-notify the next meeting's attendees when a meeting overruns. */
    overflowNotifyEnabled: boolean("overflow_notify_enabled").notNull().default(false),

    /** Adaptive availability: hide remaining slots on days already at the cap. */
    adaptiveAvailability: boolean("adaptive_availability").notNull().default(false),
    /** Max meetings/day before adaptive availability stops offering slots that day. */
    maxMeetingsPerDay: smallint("max_meetings_per_day").notNull().default(5),

    /** Encrypted JSON for sensitive / evolving preferences. */
    encryptedData: text("encrypted_data"),
    ...timestamps,
  },
  (t) => [uniqueIndex("user_preferences_user_idx").on(t.userId)],
);

/**
 * A delivery channel a user can receive reminders/notifications on. The
 * destination and any secrets (phone number, Slack user id, push token) are
 * stored encrypted in `encryptedConfig`.
 */
export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationChannelType("type").notNull(),
    /** Encrypted JSON: { phone } | { slackUserId, webhookUrl } | { pushToken, platform } | ... */
    encryptedConfig: text("encrypted_config").notNull(),
    isVerified: boolean("is_verified").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    /** Whether reminders are delivered on this channel. */
    remindersEnabled: boolean("reminders_enabled").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("notification_channels_user_idx").on(t.userId)],
);

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, { fields: [userPreferences.userId], references: [users.id] }),
}));

export const notificationChannelsRelations = relations(notificationChannels, ({ one }) => ({
  user: one(users, { fields: [notificationChannels.userId], references: [users.id] }),
}));
