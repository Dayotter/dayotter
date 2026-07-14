import { relations } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * A personal API key for the public REST API. We only ever store the SHA-256
 * hash of the key - the plaintext is shown once at creation and never again.
 * `prefix` is a short non-secret label ("csk_live_ab12…") for the UI.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

/**
 * An outbound webhook subscription. `secretEncrypted` is the HMAC signing secret
 * (AES-256-GCM at rest); the worker decrypts it to sign each delivery. `events`
 * is the set of subscribed event types (`["*"]` = all).
 */
export const webhookEndpoints = pgTable(
  "webhook_endpoints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secretEncrypted: text("secret_encrypted").notNull(),
    events: jsonb("events").$type<string[]>().notNull().default(["*"]),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("webhook_endpoints_user_idx").on(t.userId)],
);

/** A record of one webhook delivery attempt (observability + retry accounting). */
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /** pending | success | failed */
    status: text("status").notNull().default("pending"),
    responseStatus: integer("response_status"),
    attempts: integer("attempts").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("webhook_deliveries_endpoint_idx").on(t.endpointId)],
);

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  user: one(users, { fields: [webhookEndpoints.userId], references: [users.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
}));
