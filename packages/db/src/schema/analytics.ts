import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { eventTypes } from "./scheduling";

/**
 * A single view of a public event-type booking page. This is the top of the
 * booking funnel - recorded by a lightweight client beacon (`/api/track/view`),
 * so Analytics can compute view→booking conversion. `visitorId` is an opaque
 * client-generated id (localStorage) used only to count unique visitors; it
 * carries no PII.
 */
export const bookingPageViews = pgTable(
  "booking_page_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventTypeId: uuid("event_type_id")
      .notNull()
      .references(() => eventTypes.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id"),
    /** "view" (page load) | "checkout" (paid Stripe checkout started). Lets the
     * funnel show the paid-checkout drop-off, not just page→booking. */
    kind: text("kind").notNull().default("view"),
    viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("booking_page_views_type_idx").on(t.eventTypeId, t.viewedAt)],
);

export const bookingPageViewsRelations = relations(bookingPageViews, ({ one }) => ({
  eventType: one(eventTypes, {
    fields: [bookingPageViews.eventTypeId],
    references: [eventTypes.id],
  }),
}));
