# calSync — Progress Tracker

Living map of **original requirements → status**. Legend: ✅ done · 🟡 partial · ⬜ not started.
Keep this updated as features land. See [FEATURES.md](FEATURES.md) for the full catalog.

## Original must-haves (first brief)

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Sync all calendars | 🟡 | **Real sync engine ✅**: incremental delta sync (Google syncToken / MS deltaLink / Apple CalDAV poll), per-calendar busy cache with upsert+delete, push webhooks (`/api/webhooks/google,microsoft` + Graph validation handshake), auto subscription create/renew, 15-min maintenance poll for Apple + missed-webhook safety net. Worker boots & runs verified. Google + MS OAuth connect ✅. Remaining: Apple connect UI ⬜, live test vs real calendars (needs OAuth creds + public webhook URL). |
| 2 | Shared calendar between founders (team availability) | ✅ | Teams UI (create, add members, team event types), **collective** (intersection — everyone free) + **round-robin** (union + fair host assignment) booking, co-host auto-invite, public `/team/[slug]/[event]` page. Verified live with 2 users. (Member invite requires an existing calSync account — email invites are a follow-up.) |
| 3 | Scheduling time block | 🟡 | Bookings block time & prevent double-booking ✅. Manual/AI focus time-blocking ⬜. |
| 4 | Allow bookings | ✅ | Full lifecycle: book → calendar event → confirmation → reschedule → cancel. Verified live. |
| 5 | Auto email reminders (1 hr + 1 day) | ✅ | Durable BullMQ jobs, idempotent, per-recipient timezone. Verified live. |

## Second brief (10 points)

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Timezone correctness (no wrong-hour bookings) | ✅ | UTC-everywhere discipline; DST unit-tested; verified live (booker-tz rendering). |
| 2 | Remember user preferences (encrypted at rest) | 🟡 | `user_preferences` table (AES-GCM blob) ✅. **Settings UI to edit them ⬜.** |
| 3 | iOS + Android apps | 🟡 | **Expo / React Native app at `apps/mobile`** (TypeScript, shares `@calsync/core`). Screens: auth, dashboard, event types (+ **create/edit/delete**), teams, bookings (+ **detail & cancel**), **availability editor**. **Typechecks clean AND Metro-bundles clean** (verified). REST API (`/api/me,event-types,bookings,teams,schedule,bookings/[uid]`). Remaining: calendar connect, booking reschedule, team management screens. Test via Expo Go (no Xcode/emulator in the build env). |
| 4 | AI: calendar blocking, deep work, invite replies | ⬜ | Scoped in spec; not built. |
| 5 | Stay in calendar/scheduling scope | ✅ | Guardrail documented + in memory. |
| 6 | Meeting-overflow "running late" nudge | ⬜ | `overflow_notify_enabled` pref exists; detection/send not built. |
| 7 | Multi-channel reminders (push / WhatsApp / Slack) | 🟡 | `notification_channels` table (encrypted) ✅. Delivery is **email-only ⬜** (needs channel resolution + provider integrations). |
| 8 | AI natural-language scheduling ("book a call with mom") | ⬜ | Not built (needs LLM + confirm-first draft flow). |
| 9 | Reminders are part of scheduling | ✅ | Live in the scheduling domain. |
| 10 | Clean, intuitive, classy UI | ✅ | Full editorial redesign (Fraunces + warm ivory + violet + motion + product mockups). |
| — | Study Planif.ai + Todofi | ✅ | Applied to design language + AI pattern (confirm-first). |

## Platform / foundation

| Area | Status |
|---|---|
| Monorepo, DB schema (26 tables), CI-able build | ✅ |
| Auth (Better Auth: email/password + orgs + bearer for mobile) | ✅ |
| Availability engine (pure, DST-tested) | ✅ |
| Booking write / reschedule / cancel | ✅ |
| Availability editor UI | ✅ |
| Event-type create / edit / delete | ✅ |
| Marketing site (hero, bento, mobile, CTA, footer) | ✅ |
| Mobile REST API (bearer-authed read endpoints) | ✅ |
| Expo/React Native app foundation (`apps/mobile`) | 🟡 (core screens; typechecked, not yet run on a simulator) |

## Nearest gaps (priority order)

1. ~~Team / collective + round-robin scheduling~~ ✅ **DONE** (verified live 2026-07-03).
2. **Settings UI** — profile + preferences + notification channels (surfaces built-but-unused schema; original 2nd-brief #2 & #7). ← next
3. **Apple/iCloud connect UI** (adapter already built).
4. **Meeting-overflow nudge** (worker detection + send).
5. **Multi-channel reminder delivery** (resolve channels at send time; push/Slack/WhatsApp providers).
6. **AI scheduling** (NL → confirm-first draft) + smart time-blocking.
7. **Webhooks / incremental sync**, analytics, workflows builder.
8. **Team email invites** (invite people who don't have an account yet — Better Auth org plugin has invitations table).
