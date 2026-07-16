---
name: calendar-availability
description: How scheduling actually works in DayOtter - the pure availability engine (DST-correct, integer-ms slot math), the busy_blocks cache the sync worker maintains, provider adapters, best-effort push subscriptions, and the booking lifecycle fan-out. Load this when touching availability, calendar sync, busy caching, bookings, or the sync/reminder workers.
---

# Calendar & availability

## The engine (`packages/core/src/availability/engine.ts`)

`computeAvailability(input)` is **pure and deterministic** - same inputs, same
slots - which is why it's trivially unit-tested. It:
- iterates day-by-day in the schedule's timezone (Luxon) so **DST is correct**,
- steps slots with **integer-millisecond math** (a perf refactor; equivalent to
  Luxon `.plus({minutes})`, verified byte-identical by the DST tests),
- checks the pre-sorted busy intervals with buffers, returns **absolute instants**.

`intersectAvailability` powers collective team scheduling ("when are we all free").

**Rule:** the engine reads only the cached busy blocks, never a provider API. The
booker's timezone is applied at the edge, never inside the math. Any change to
slot math must keep `engine.test.ts` (incl. the DST cases) green.

## The busy cache & sync worker (`apps/worker/src/workers/sync.ts`)

The sync worker incrementally pulls each connection's calendars (Google
`syncToken` / MS `deltaLink` / CalDAV poll), upserts `calendar_events` (rich model)
and its lean `busy_blocks` projection in one pass, and advances the cursor.

**Push subscriptions are best-effort.** `ensureSubscription` registers a provider
watch/webhook, but a failure there (e.g. Google "Push notifications are not
supported by this resource", unverified webhook domain, read-only calendar) is
caught and logged - it must **not** fail the sync, because the events already
synced and polling keeps the cache fresh. Push is an optimization, not a
dependency. Also skipped entirely when `APP_URL` isn't a public `https://` URL.

## Booking lifecycle

Create / reschedule / cancel go through `apps/web/lib/booking/lifecycle.ts`
(`fanOutBookingLifecycle`) which dedups the side effects: emit webhook + enqueue
CRM sync + run plugin booking hooks. Add new booking side effects there, not in
each route.

Indexes that matter: `bookings_host_slot_active_idx` (unique, prevents
double-booking a host at one instant) + a GiST exclusion constraint for overlap;
`bookings(eventTypeId, startsAt)` for range scans.

## Gotchas

- Two insights windows differ on purpose: the insights *page* uses `[-30d, +30d]`;
  time-allocation (`lib/analytics/time-allocation`) uses a rolling ±windowDays
  (`spanDays` normalizes rates) so upcoming meetings still register.
- Group event types (`isGroup`) are exempt from the single-slot guards; capacity
  is enforced transactionally in `createBooking`.
