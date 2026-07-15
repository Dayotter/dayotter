import { index, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * Generic key/value storage for plugins, so an extension can persist data
 * without shipping its own migration. Scoped by (plugin id, user, key). Plain
 * JSON goes in `value`; secrets (API tokens, connector credentials) go in
 * `secret` as an AES-256-GCM ciphertext string. The host exposes this as a
 * scoped storage API - a plugin only ever sees its own rows.
 */
export const pluginData = pgTable(
  "plugin_data",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The plugin's stable id (e.g. "notes"). */
    pluginId: text("plugin_id").notNull(),
    /** The user this row belongs to. Null = plugin-global (not user-scoped). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value"),
    /** Encrypted string payload for credentials (never in `value`). */
    secret: text("secret"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("plugin_data_scope_key_idx").on(t.pluginId, t.userId, t.key),
    index("plugin_data_plugin_user_idx").on(t.pluginId, t.userId),
  ],
);
