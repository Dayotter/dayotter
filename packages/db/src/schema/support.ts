import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./_shared";

/**
 * A message submitted through the public contact form. Persisted BEFORE the
 * notification email is attempted, so a mail outage never loses the message -
 * the row is the source of truth and `emailedAt` records whether the team was
 * successfully notified (null = the email hasn't gone out yet).
 */
export const contactSubmissions = pgTable(
  "contact_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    /** When the team notification email was sent (null = not yet / send failed). */
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("contact_submissions_created_idx").on(t.createdAt)],
);
