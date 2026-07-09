import { pgEnum, timestamp } from "drizzle-orm/pg-core";

/** Columns every table carries. Spread into table definitions. */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---- Enums (shared across schema modules) ----

export const membershipRole = pgEnum("membership_role", ["owner", "admin", "member"]);

export const calendarProvider = pgEnum("calendar_provider", ["google", "microsoft", "apple"]);

export const connectionStatus = pgEnum("connection_status", [
  "active",
  "expired",
  "error",
  "revoked",
]);

export const locationType = pgEnum("location_type", [
  "google_meet",
  "zoom",
  "ms_teams",
  "phone",
  "in_person",
  "custom",
]);

export const schedulingType = pgEnum("scheduling_type", [
  "individual",
  "collective",
  "round_robin",
]);

export const bookingStatus = pgEnum("booking_status", [
  "pending", // awaiting confirmation / payment
  "confirmed",
  "cancelled",
  "rejected",
]);

export const workflowTrigger = pgEnum("workflow_trigger", [
  "before_event",
  "after_event",
  "on_booking",
  "on_cancel",
  "on_reschedule",
]);

export const workflowAction = pgEnum("workflow_action", ["email", "sms"]);

export const notificationChannelType = pgEnum("notification_channel_type", [
  "email",
  "sms",
  "push", // mobile push (APNs / FCM)
  "whatsapp",
  "slack",
]);

/** Payment lifecycle for a booking. "none" = the event type was free. */
export const paymentStatus = pgEnum("payment_status", ["none", "pending", "paid", "refunded"]);

export const timeFormat = pgEnum("time_format", ["12h", "24h"]);
export const themePref = pgEnum("theme_pref", ["system", "light", "dark"]);
