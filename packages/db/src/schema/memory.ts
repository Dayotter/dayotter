import { relations } from "drizzle-orm";
import { jsonb, pgTable, real, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { users } from "./orgs";

/**
 * Otter's long-term memory: derived patterns and stated preferences about a
 * user that make the assistant smarter over time. One row per (user, key); the
 * memory refresh re-derives and upserts. `label` is the human-readable line fed
 * into Otter's prompt; `value` is the structured data behind it. See
 * apps/web/lib/ai/memory/README.md for the module design + how to add facts.
 */
export const otterMemory = pgTable(
  "otter_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** pattern | preference | contact | fact */
    kind: text("kind").notNull().default("pattern"),
    /** Stable extractor key, e.g. "typical_duration" (unique per user). */
    memoryKey: text("memory_key").notNull(),
    /** Structured data behind the fact. */
    value: jsonb("value"),
    /** One-line human summary injected into Otter's prompt. */
    label: text("label").notNull(),
    confidence: real("confidence").notNull().default(0.5),
    /** derived | user | inferred */
    source: text("source").notNull().default("derived"),
    ...timestamps,
  },
  (t) => [uniqueIndex("otter_memory_user_key_idx").on(t.userId, t.memoryKey)],
);

export const otterMemoryRelations = relations(otterMemory, ({ one }) => ({
  user: one(users, { fields: [otterMemory.userId], references: [users.id] }),
}));
