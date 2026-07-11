import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps, workflowAction, workflowTrigger } from "./_shared";
import { bookings } from "./booking";
import { organizations } from "./orgs";
import { eventTypes } from "./scheduling";

/** An automation: "1 hour before the event, email the attendee." */
export const workflows = pgTable(
  "workflows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    trigger: workflowTrigger("trigger").notNull(),
    /** For before/after triggers: how many minutes offset from the event. */
    offsetMinutes: integer("offset_minutes").notNull().default(0),
    action: workflowAction("action").notNull().default("email"),
    subjectTemplate: text("subject_template"),
    bodyTemplate: text("body_template"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [index("workflows_org_idx").on(t.organizationId)],
);

/** Which event types a workflow applies to. */
export const workflowEventTypes = pgTable(
  "workflow_event_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .notNull()
      .references(() => workflows.id, { onDelete: "cascade" }),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
  },
  (t) => [index("workflow_event_types_workflow_idx").on(t.workflowId)],
);

/**
 * A concrete scheduled reminder for one booking, backed by a BullMQ delayed job.
 * `jobId` lets us cancel/reschedule the queue entry when a booking changes.
 */
export const scheduledReminders = pgTable(
  "scheduled_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bookingId: uuid("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    workflowId: uuid("workflow_id").references(() => workflows.id, { onDelete: "cascade" }),
    /** "reminder" (before the meeting) | "followup" (after it). */
    kind: text("kind").notNull().default("reminder"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    jobId: text("job_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("scheduled_reminders_booking_idx").on(t.bookingId),
    index("scheduled_reminders_due_idx").on(t.scheduledFor),
  ],
);

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workflows.organizationId],
    references: [organizations.id],
  }),
  eventTypes: many(workflowEventTypes),
}));

export const workflowEventTypesRelations = relations(workflowEventTypes, ({ one }) => ({
  workflow: one(workflows, { fields: [workflowEventTypes.workflowId], references: [workflows.id] }),
  eventType: one(eventTypes, {
    fields: [workflowEventTypes.eventTypeId],
    references: [eventTypes.id],
  }),
}));

export const scheduledRemindersRelations = relations(scheduledReminders, ({ one }) => ({
  booking: one(bookings, { fields: [scheduledReminders.bookingId], references: [bookings.id] }),
  workflow: one(workflows, {
    fields: [scheduledReminders.workflowId],
    references: [workflows.id],
  }),
}));
