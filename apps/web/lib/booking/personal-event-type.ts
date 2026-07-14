import { ne, schema } from "@dayotter/db";

/**
 * Reserved slug for the hidden, per-user event type that Otter's ad-hoc "book /
 * hold" meetings hang off of (so `bookings.eventTypeId` stays non-null without
 * modelling ad-hoc events specially). It is `isPrivate` + `isActive: false`, and
 * every user-facing listing excludes it via `notPersonalType`.
 */
export const PERSONAL_EVENT_TYPE_SLUG = "__personal";

/** Drizzle predicate: exclude the hidden Personal type from an event-type list. */
export const notPersonalType = ne(schema.eventTypes.slug, PERSONAL_EVENT_TYPE_SLUG);
