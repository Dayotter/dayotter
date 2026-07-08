# calSync — Architecture

## The three core systems

Everything else is product work on top of these:

1. **Calendar sync engine** (`packages/calendar` + `apps/worker`) — bidirectional
   sync across Google / Microsoft / Apple behind one `CalendarAdapter` interface.
   Real-time via provider webhooks (Google `watch`, MS Graph subscriptions);
   Apple/CalDAV is poll-based. Busy times land in a Postgres cache (`busy_blocks`).
2. **Availability engine** (`packages/core`) — a pure function: given a schedule,
   busy blocks, and event constraints, return bookable slots. Timezone/DST-correct
   via Luxon. Fully unit-tested. `intersectAvailability` powers collective team
   scheduling; `roundRobinPick` powers weighted round-robin.
3. **Durable jobs** (`apps/worker`) — BullMQ on Redis for reminders (1d / 1h) and
   sync. Reminders are idempotent (a `scheduled_reminders` row + a `jobId`), so a
   reschedule cleanly replaces the pending job and nothing double-sends.

## Data model (packages/db)

Tenanted on `organizations`. Key tables:

- **orgs**: `organizations`, `users`, `memberships` (RBAC)
- **calendar**: `calendar_connections` (encrypted OAuth tokens), `calendars`,
  `webhook_subscriptions`, `busy_blocks` (free/busy cache)
- **scheduling**: `schedules`, `availability_rules`, `date_overrides`, `event_types`
- **booking**: `bookings`, `booking_attendees`, `booking_references` (per-provider
  event id for two-way sync)
- **team**: `teams`, `team_members`, `event_type_hosts` (round-robin pools)
- **workflow**: `workflows`, `workflow_event_types`, `scheduled_reminders`

## Request flows

### Booking-page availability (read)
`GET /api/availability/:eventTypeId` → load event type + schedule + cached busy
blocks from Postgres → `computeAvailability()` → JSON slots. No provider API calls
on the hot path; the cache is kept warm by the sync worker.

### A booking is made (write)
Create `bookings` row → `CalendarAdapter.createEvent()` on the host's target
calendar (+ Meet/Teams link) → store `booking_references` → send confirmation →
enqueue reminder jobs at (start − 1d) and (start − 1h).

### An external calendar changes (sync)
Provider webhook → `sync` queue → adapter `getBusy()` over the rolling window →
replace `busy_blocks` for those calendars. (Next step: incremental `syncToken`
deltas instead of full-window refresh.)

## Security

OAuth tokens are encrypted at rest with AES-256-GCM (`packages/core/crypto`,
`ENCRYPTION_KEY`). Tokens never leave the worker/server boundary.

## Known scaffolding / next steps

- OAuth connect routes + Better Auth wiring (sign-in, orgs) — not yet built.
- Webhook receiver endpoints + subscription renewal jobs.
- Sync currently does a full-window free/busy refresh and attributes busy blocks
  to the primary conflict calendar; switch to per-calendar incremental deltas.
- Apple/CalDAV adapter needs live testing against iCloud.
- Booking write flow (create/reschedule/cancel) + public booking UI.
