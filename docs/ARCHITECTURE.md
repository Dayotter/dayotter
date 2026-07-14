# Architecture

DayOtter is a TypeScript monorepo (pnpm + Turborepo). This is the map of what
lives where and why. For the AI subsystem see [`AI.md`](./AI.md); for the
open-core boundary see [`ENTERPRISE.md`](./ENTERPRISE.md).

## The engines (single sources of truth)

Every feature builds on these; nothing duplicates their logic.

1. **Timezone** - Luxon everywhere; all times stored UTC, rendered per-viewer.
2. **Sync** (`packages/calendar` + `apps/worker/sync`) - bidirectional sync across
   Google / Microsoft / Apple (CalDAV) / ICS behind one `CalendarAdapter`.
   Real-time via provider webhooks; Apple/ICS is poll-based. Busy times land in a
   Postgres cache (`busy_blocks`) - the availability engine reads only the cache.
3. **Availability** (`packages/core/availability`) - a pure function: schedule +
   busy blocks + constraints → bookable slots. DST-correct, unit-tested.
4. **Notification** (`packages/jobs` + `apps/worker/reminders` + `packages/notifications`) -
   durable BullMQ delayed jobs; multi-channel delivery.
5. **LLM** (`apps/web/lib/ai/llm.ts`) - the single Anthropic choke point; model
   tiering, prompt caching, structured output. Every AI feature goes through it.

## Monorepo layout

```
apps/
  web       Next.js 15 - dashboard, public booking pages, REST API, Otter
  worker    Node + BullMQ - reminders, sync, maintenance, briefings, scribe, webhooks
  mobile    Expo / React Native (expo-router) - iOS + Android
packages/
  core          availability engine, weighted round-robin, crypto, SSRF guards (pure)
  db            Drizzle schema (split by domain) + Postgres client
  jobs          BullMQ queues + producers (shared web↔worker contracts)
  calendar      Google / Microsoft / Apple / ICS adapters behind one interface
  integrations  binds stored connections to the calendar adapters (token refresh)
  notifications Slack / Twilio (SMS·WhatsApp) / Expo push / web push
  emails        Nodemailer + transactional templates
  auth          Better Auth server instance (identity + organizations)
```

## `apps/web/lib` - by domain

### booking/
The scheduling core. `create-booking.ts` (validate slot → write booking +
attendees → calendar → reminders → webhooks), `availability.ts` (adapts the core
engine to event types: `hostSlots`), `host-booking.ts` (host-initiated/Otter
bookings, hung off the hidden `__personal` event type - see
`personal-event-type.ts`), `cancel-booking.ts` / `reschedule-booking.ts`,
`reminders.ts` (schedules reminders, workflow messages, overflow checks, scribe),
`insights.ts` + `analytics.ts` + `focus-insights.ts` (metrics), `focus-suggestions.ts`
(deep-work windows), `travel.ts`, `running-late.ts`, `overlay.ts` (booker-side
calendar overlay), `rank-slots.ts`, `team-schedule.ts`.

### ai/  → see [`AI.md`](./AI.md)
`llm.ts`, `interpret.ts` (the shared brain), `command-parse.ts`, `agent.ts`,
`chat.ts`, `retrieval.ts` (RAG-lite), `tools/` (registry + exec), `memory/`,
`proactive.ts`, `invite-triage.ts`, `meeting-actions.ts`.

### analytics/time-allocation/
"Where your time goes" - a pluggable metric registry (`METRICS[]`) over one
dataset. Extensible; see its README.

### voice/  → see [`AI.md`](./AI.md)
The AI phone receptionist: `receptionist.ts`, `knowledge.ts` (pluggable sources),
`resolver.ts`, `twiml.ts`.

### messaging/
`otter-sms.ts` (inbound SMS/WhatsApp → confirm-first Otter),
`twilio-signature.ts` (shared, fail-closed HMAC validation).

### packages/ (in-app)
Prepaid session bundles: `credits.ts` (atomic spend), `fulfill.ts` (Stripe grant).

### billing/  → see [`ENTERPRISE.md`](./ENTERPRISE.md)
`edition.ts` (`isCloud`), `features.ts` (free/pro/cloud tiers + `hasFeature`),
`entitlements.ts`, `require-feature.ts` (402 gate on cloud+free only),
`subscription.ts` (Stripe sync).

### payments/
`stripe.ts` (the one Stripe layer, env-gated), `pending.ts` (Redis stash during
Checkout), `fulfill.ts` (idempotent paid→booking).

### calendar/
`host-calendar.ts` (write to the host's target calendar), `calendar-connect.ts`,
`providers.ts` (OAuth app config), `oauth-state.ts` (signed anti-CSRF state),
`invites.ts` / `invite-actions.ts` / `inbox.ts` (calendar inbox).

### server/
`http.ts` (`withUser`, `jsonError`), `rate-limit.ts` (Redis token bucket),
`env.ts` (Zod-validated typed env), `api-key.ts` (public API key auth).

### routing/ · polls/ · intelligence/ · automation/ · webhooks/ · integrations/
Routing forms; meeting polls; the recommendations engine; automation rules
(`apply-rules.ts`); outbound webhook fan-out (`emit.ts`, SSRF-hardened); Zoom.

## `packages/db/schema` (Drizzle, split by domain)

`orgs` (organizations, users, memberships) · `auth` (sessions, accounts) ·
`team` (teams, members, rules) · `scheduling` (schedules, availabilityRules,
timeBlocks, automationRules, eventTypes) · `booking` (bookings, attendees,
references) · `calendar` (connections, calendars, busyBlocks) · `conferencing` ·
`poll` · `routing` · `workflow` (workflows, scheduledReminders) · `packages`
(sessionPackages, packageCredits) · `memory` (otterMemory) · `analytics`
(bookingPageViews) · `preferences` (userPreferences, notificationChannels) ·
`developer` (apiKeys, webhookEndpoints, webhookDeliveries).

Migrations live in `packages/db/drizzle/*.sql` (drizzle-kit generate; never
hand-edit).

## `apps/worker`

`reminders` (due reminders / follow-ups / no-show / running-late / recap /
workflow emails) · `sync` (incremental calendar sync over a 90-day window) ·
`maintenance` (~15-min tick: auto-complete past bookings, drives
`materializeWeeklyBlocks` + `sendDueBriefings`) · `webhooks` (signed,
SSRF-hardened outbound delivery).

## Conventions

- **Types are the contract.** `pnpm turbo typecheck` gates everything.
- **Confirm-first for AI.** Otter proposes; a human confirms. See `AI.md`.
- **Feature-gate at the edition, not per user.** `isCloud` is deploy-time.
- **Best-effort side effects never break the booking.** Calendar writes,
  reminders, webhooks are wrapped and logged, not fatal.
