# dayotter - Architecture Decisions

Load-bearing principles. Violating these gets expensive to undo, so they're
recorded here and enforced in review.

## 1. Timezone discipline (never produce a wrong booking)

The failure mode: the host's schedule tz, the app's tz, and the booker's tz
disagree, and a naive comparison books the wrong hour.

Rules:
- **Store every instant in UTC** (`timestamptz`). A `Date`/`timestamptz` is always
  an absolute instant - never a wall-clock time.
- **Wall-clock values always carry an explicit IANA timezone.** Availability
  windows ("09:00") are stored as `time` + the schedule's `timezone`; they are
  only ever resolved to an instant *through Luxon with that zone*.
- The **availability engine returns absolute instants**; the booker's timezone is
  a *presentation* concern applied at the edge, never in the math.
- **Three timezones are tracked explicitly:** schedule tz (host availability),
  booker tz (stored on the booking + attendee), event tz (written to the calendar
  event). Confirmation/reminder copy renders in each recipient's own tz.
- **DST is covered by tests** (`engine.test.ts` → "timezone / DST correctness").
  Any change to slot math must keep those green.

## 2. API-first - web and mobile are peer clients

Android and iOS apps are coming. So:
- **All domain logic lives in `packages/*`, never in `apps/web`.** The Next.js app
  is one client; it must not be the only place a rule exists.
- The server exposes a **stable, versioned API** (`/api/v1/...`, REST + OpenAPI)
  that both the web app and the mobile apps consume. tRPC may be used internally,
  but the mobile-facing contract is REST/OpenAPI.
- **Auth is token-based** (bearer/JWT + refresh) so native apps authenticate the
  same way the web does - not cookie-only.
- Shared DTOs/validation (Zod) live in a package so a future `apps/mobile`
  (React Native / Expo) reuses them. Push tokens are a notification channel
  (`notification_channels.type = 'push'`), not a web afterthought.

## 3. AI scope - scheduling only, confirm-first

We add AI, but **strictly within calendar & scheduling**. In scope:
- Natural-language scheduling: "schedule a call with mom Friday afternoon",
  "book 30 min with the design team next week".
- Smart calendar blocking / deep-work protection (auto-place focus blocks around
  meetings).
- Calendar-invite handling: accept / decline / propose-new-time, and short
  meeting-scoped replies ("can we push to 3?").
- Meeting-overflow detection and the "running late" nudge.

Explicitly **out of scope** (do not build): general email writing, a general
personal assistant, non-calendar task management, chit-chat.

**UX pattern (from Planif.ai): AI proposes, human confirms.** NL input resolves to
a **pre-filled, editable draft** (event/reminder/block) that the user confirms.
The AI never silently mutates the calendar.

## 4. Preferences & secrets encrypted at rest

- Sensitive/free-form user preferences and all notification-channel destinations
  (phone, Slack id, push token) are **AES-256-GCM encrypted** (`user_preferences.
  encrypted_data`, `notification_channels.encrypted_config`) via
  `@dayotter/core` crypto with `ENCRYPTION_KEY`.
- OAuth tokens are already encrypted the same way. Plaintext secrets never hit
  the database or logs.

## 5. Reminders are part of scheduling, and multi-channel

Reminders are not a separate product area - they live inside the scheduling
domain (`workflows` + `scheduled_reminders`). Delivery is **channel-agnostic**:
the worker resolves a user's enabled `notification_channels`
(email / push / WhatsApp / Slack / SMS) at send time and fans out per preference.
Durability guarantees (idempotent, never-dropped) apply to every channel.
