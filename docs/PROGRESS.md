# DayOtter - Progress Tracker

Living map of the **original brief requirements → status**. Legend: ✅ done ·
🟡 partial · ⬜ not started.

> This page tracks the *original* asks. For where the product is heading next, see
> the [Roadmap](ROADMAP.md) (the maintained forward-looking list) and the full
> [Feature catalog](FEATURES.md). The original brief is now essentially complete;
> the one requirement not fully shipped is native mobile (built, pending a device
> test + store submission).

## Original must-haves (first brief)

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Sync all calendars | ✅ | Incremental delta sync (Google syncToken / MS deltaLink / Apple CalDAV poll), per-calendar busy cache, push webhooks + Graph handshake, auto subscription renewal, 15-min maintenance backstop. Google / Microsoft / Apple (CalDAV) / ICS all connectable from Settings → Calendars. |
| 2 | Shared calendar between founders (team availability) | ✅ | Teams UI, **collective** + weighted **round-robin** booking, co-host auto-invite, routing forms, shared availability view, member invites (org invitations table + pending-invites UI). |
| 3 | Scheduling time block | ✅ | Bookings block time & prevent double-booking; manual + AI focus/deep-work blocking (Otter `protect_focus_time`, adaptive availability, travel buffers, reclaim-on-cancel). |
| 4 | Allow bookings | ✅ | Full lifecycle: book → calendar event → confirmation → reschedule → cancel, with payments + prepaid packages. |
| 5 | Auto email reminders (1 hr + 1 day) | ✅ | Durable BullMQ jobs, idempotent, per-recipient timezone. |

## Second brief (10 points)

| # | Requirement | Status | Notes |
|---|---|---|---|
| 1 | Timezone correctness (no wrong-hour bookings) | ✅ | UTC-everywhere; DST unit-tested. |
| 2 | Remember user preferences (encrypted at rest) | ✅ | `user_preferences` (AES-GCM blob for sensitive data) + full Settings UI (profile, preferences, notifications, automations, calendars, CRM, billing, developer). |
| 3 | iOS + Android apps | 🟡 | Expo / React Native app (`apps/mobile`, SDK 53, shares `@dayotter/core`): auth, dashboard, event types (CRUD), teams, bookings (+ detail & cancel), availability editor, voice capture. Typechecks + Metro-bundles clean. **Remaining: run on a device, then build the AAB and submit to the stores** (also clears the Google Play 16 KB page-size gate). |
| 4 | AI: calendar blocking, deep work, invite replies | ✅ | Otter does confirm-first focus/deep-work blocking; calendar invites surface in the Inbox with accept/decline; running-late overflow nudges ship. |
| 5 | Stay in calendar/scheduling scope | ✅ | Guardrail documented + enforced in Otter's system prompt. |
| 6 | Meeting-overflow "running late" nudge | ✅ | Worker detects overrun and notifies the next meeting's attendees (opt-in per user). |
| 7 | Multi-channel reminders (push / WhatsApp / Slack) | ✅ | Delivery across email, Slack, SMS, WhatsApp, mobile push, and browser (web) push; channels resolved at send time. |
| 8 | AI natural-language scheduling ("book a call with mom") | ✅ | Otter: chat + hands-free voice mode + inbound WhatsApp/SMS + AI voice receptionist, all confirm-first. |
| 9 | Reminders are part of scheduling | ✅ | Native to the scheduling domain. |
| 10 | Clean, intuitive, classy UI | ✅ | Editorial redesign (Geist type system, warm palette, motion, product mockups). |
| - | Study Planif.ai + Todofi (and later asknoa, ticktick, scheduling.studio, codot) | ✅ | Applied to the design language + the confirm-first AI pattern. |

## Platform / foundation

| Area | Status |
|---|---|
| Monorepo, DB schema, migrations, CI-able build | ✅ |
| Auth (Better Auth: email/password + Google + phone/OTP + orgs + bearer for mobile) | ✅ |
| Availability engine (pure, DST-tested) | ✅ |
| Booking write / reschedule / cancel, payments, packages | ✅ |
| Settings UI (profile, preferences, notifications, automations, calendars, CRM, billing, developer) | ✅ |
| AI (Otter): command bar, chat, hands-free voice, memory, proactive suggestions, voice receptionist | ✅ |
| Analytics: booking funnel + "where your time goes" | ✅ |
| Native CRM sync (Salesforce / HubSpot) | 🟡 beta (built; needs a live test with provider credentials) |
| Webhooks + API keys, automations/workflows, group polls, routing forms | ✅ |
| Self-host: Docker/compose, one-command + AWS one-click installers | ✅ |
| Mobile app (Expo, iOS + Android) | 🟡 built; pending device test + store submission |

## Remaining gaps (priority order)

1. **Mobile: device test → build AAB → submit to stores** (clears the Google Play 16 KB gate). The only original requirement not fully shipped.
2. **CRM sync: beta → GA** - live-test the Salesforce/HubSpot OAuth + push, then add field mapping and CRM-side routing.
3. Everything else is forward-looking - see the [Roadmap](ROADMAP.md): Real Scribe (transcription), team briefings, deeper analytics, Zapier app, self-host SSO, proactive weekly planning.
