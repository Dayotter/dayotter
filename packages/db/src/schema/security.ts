import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";
import { organizations, users } from "./orgs";

/**
 * A record of the AI assistant hitting a guardrail - currently a blocked
 * injection / jailbreak attempt caught by `screenUserInput` before a model call.
 *
 * Persisted so the workspace owner gets a throttled security alert email + a
 * dashboard log, rather than the hit only living in server logs. The worker
 * reads unnotified rows, emails the owner (rate-limited per org), and stamps
 * `notifiedAt`.
 */
export const guardrailEvents = pgTable(
  "guardrail_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Org whose owner is alerted. Null for a public / anonymous surface. */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    /** The signed-in user who tripped it, if any. Null for public surfaces. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Where it happened: "chat" | "booking-assistant" | "voice". */
    source: text("source").notNull(),
    /** Why it was blocked: "injection" (the only pre-model reason today). */
    reason: text("reason").notNull(),
    /** First ~200 chars of the offending input, for the owner to eyeball. */
    sample: text("sample").notNull().default(""),
    /** When the owner alert email was sent (null = pending or suppressed). */
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("guardrail_events_org_idx").on(t.organizationId, t.createdAt),
    // Drives the worker's "unnotified rows" scan.
    index("guardrail_events_notify_idx").on(t.notifiedAt),
  ],
);
