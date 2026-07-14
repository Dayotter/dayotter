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
import { timestamps } from "./_shared";
import { users } from "./orgs";

/** A question on a routing form. `select` fields are the ones routes match on. */
export interface RoutingField {
  id: string;
  label: string;
  type: "select" | "text" | "email";
  options?: string[];
  required?: boolean;
}

/** One ordered rule: when `fieldId`'s answer equals `equals`, book `eventTypeId`. */
export interface RoutingRoute {
  id: string;
  fieldId: string;
  equals: string;
  eventTypeId: string;
}

/**
 * A routing form ("qualify then route"): visitors answer a few questions and are
 * sent to the right booking page - a specific event type / host - based on their
 * answers. The inbound-qualification flow both Cal.com and Calendly lead with.
 */
export const routingForms = pgTable(
  "routing_forms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hostId: uuid("host_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    token: text("token").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    fields: jsonb("fields").$type<RoutingField[]>().notNull().default([]),
    routes: jsonb("routes").$type<RoutingRoute[]>().notNull().default([]),
    /** Where to send an answer that matches no route. */
    fallbackEventTypeId: uuid("fallback_event_type_id"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("routing_forms_token_idx").on(t.token),
    index("routing_forms_host_idx").on(t.hostId),
  ],
);

/** A submitted answer set + where it routed - for the responses view / analytics. */
export const routingFormResponses = pgTable(
  "routing_form_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    formId: uuid("form_id")
      .notNull()
      .references(() => routingForms.id, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, string>>().notNull(),
    routedEventTypeId: uuid("routed_event_type_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("routing_form_responses_form_idx").on(t.formId)],
);

export const routingFormsRelations = relations(routingForms, ({ one, many }) => ({
  host: one(users, { fields: [routingForms.hostId], references: [users.id] }),
  responses: many(routingFormResponses),
}));

export const routingFormResponsesRelations = relations(routingFormResponses, ({ one }) => ({
  form: one(routingForms, {
    fields: [routingFormResponses.formId],
    references: [routingForms.id],
  }),
}));
