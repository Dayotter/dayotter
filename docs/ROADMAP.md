# calSync Roadmap & Build Tracker

> The single source of truth for **what's built, what's partial, and what's next**.
> Organized by the layered **Time-OS engine model**: every feature builds on an
> engine below it; no feature duplicates scheduling / timezone / notification /
> sync logic. Update this doc as things land.

**Legend:** ✅ done · 🟡 partial · ⬜ not started · ⭐ differentiator

**Architectural rule (non-negotiable):** a new feature must build on an existing
engine, never introduce parallel business logic. Engines are the single source of
truth: **Timezone**, **Sync**, **Availability**, **Notification**, **LLM**,
**Payments**. Everything else composes them.

---

## Phase 0 — Core Platform
| Capability | Status | Notes |
|---|---|---|
| Email/password, Google, Microsoft sign-in | ✅ | Better Auth |
| Sessions, multi-device, bearer (mobile) | ✅ | |
| Account recovery (password reset) | ⬜ | no reset-email flow yet |
| Profile: name, photo, timezone, locale | 🟡 | photo = `image` URL only (no upload); working-location + language ⬜ |
| Preferences (encrypted): hours, days, reminders, channels, time format | ✅ | AES-256-GCM `encryptedData` |
| Lunch hours / calendar defaults | ⬜ | |
| Postgres, Redis, job queue, background workers | ✅ | BullMQ |
| **Object storage** (avatars/attachments) | ⬜ | **NEW** — needed for photo upload + attachments |
| **Audit logs** | ⬜ | **NEW** |
| **Metrics** | 🟡 | structured `logger` + `/health` only; no metrics pipeline |
| **Feature flags** | ⬜ | **NEW** |

## Phase 1 — Calendar Engine ⭐ (highest priority: "nothing else matters if calendars can't be trusted")
| Capability | Status | Notes |
|---|---|---|
| Google / Microsoft / Apple(CalDAV) providers | ✅ | adapters behind one interface |
| Generic CalDAV (Fastmail/Nextcloud) | 🟡 | adapter takes `serverUrl`, no UI |
| **ICS feed import / .ics upload** | ⬜ | **NEW** — only ICS *export* exists |
| Initial / incremental / webhook sync + reconciliation | ✅ | syncToken/delta + maintenance job |
| Duplicate detection | ✅ | busy_blocks upsert on `(calendarId, externalEventId)` |
| Deleted-event handling | ✅ | `deletedExternalIds` |
| Sync retries | ✅ | BullMQ |
| **Conflict resolution (bidirectional edits)** | 🟡 | last-writer-wins on our writes; no merge policy |
| Connect / disconnect calendars | ✅ | |
| Pick conflict-check calendars / write-target | ✅ | `checkForConflicts` |
| **Rename calendars, visibility, read-only/writable controls** | ⬜ | **NEW** — `color`/`name` stored, no UI |
| **Unified full event model** (title, guests, recurrence, location, privacy, metadata) | ✅ | `calendar_events` table (migration 0008); adapters ingest full events; `busy_blocks` is now its lean availability projection. Attachments field TBD. |
| Calendar health: last sync, OAuth expiry, errors | 🟡 | `lastError`/`lastSyncedAt` shown; **timezone-inconsistency / missing-event / duplicate detection ⬜ (NEW)** |
| Timezone Engine (DST, organizer/viewer/device) | ✅ | Luxon, DST-tested |
| **Floating events / traveling-user timezone** | ⬜ | **NEW** |

## Phase 2 — Scheduling Engine
| Capability | Status | Notes |
|---|---|---|
| Availability engine (working hours, buffers, focus, holidays, limits, tz) | ✅ | pure + unit-tested |
| **Ranked availability / conflict reasons / suggested alternatives** | ⬜ | **NEW** — engine returns flat slots only |
| Booking links: 1:1, collective, round-robin | ✅ | |
| **Group events** (many bookers, one slot) | ⬜ | **NEW** |
| Unlimited event types (duration/buffer/questions/platform/notifications) | ✅ | |
| Multiple durations · slot interval · min-gap · daily limit | ✅ | shipped this session |
| **Expiring / password-protected / one-off links** | ⬜ | one-off ⬜, expiring ⬜, password ⬜ (**NEW**) |
| Private/secret event types · redirect · color · duplicate | ✅ | |
| Booking pages: public profile, team, mobile-friendly | ✅ | |
| **Branded booking pages · embedded widget** | ⬜ | |
| Scheduling policies: min notice, daily/weekly limits, window | ✅ / 🟡 | weekly limit ⬜ |
| **No-meeting windows · preferred weekdays** | 🟡 | date-overrides support it in engine; no dedicated UI |
| **Date-specific overrides UI · multiple named schedules** | ⬜ | engine supports; editor UI missing |
| Payments: require payment, deposits, refunds, multi-currency | ✅ | Stripe, shipped this session |

## Phase 3 — Planning Engine
| Capability | Status | Notes |
|---|---|---|
| Manual time blocks / focus blocks | 🟡 | deep-work "protect" writes a block; no first-class block manager |
| **Recurring / flexible / protected blocks** | ⬜ | **NEW** |
| Deep work: focus sessions, **targets, auto-protection, weekly goals** | 🟡 | suggestions only; targets/goals ⬜ |
| Planning views: daily / weekly / monthly / agenda | ✅ | calendar views shipped this session |
| **Timeline view** | ⬜ | **NEW** |
| **Schedule balancing** (overloaded/empty days, redistribution, density viz) | ⬜ | **NEW** |
| **Personal events** (travel, exercise, family, birthdays) | ⬜ | **NEW** — needs the unified event model |

## Phase 4 — Communication Engine
| Capability | Status | Notes |
|---|---|---|
| Channels: email, push, Slack, WhatsApp, SMS | ✅ | desktop ⬜ |
| Reminder engine: 1d, 1h, custom | ✅ | recurring reminders 🟡 |
| Delay management (overflow → notify next meeting) | ✅ | ⭐ shipped; auto-detection of overrun ⬜ |
| Invitation inbox: accept / decline / tentative | ✅ | **suggest-another-time · delegate ⬜ (NEW)** |

## Phase 5 — Automation Engine
| Capability | Status | Notes |
|---|---|---|
| Natural-language scheduling (create / reschedule / cancel) | ✅ | confirm-first, singular LLM layer |
| **Automation rules** (trigger → action: "every Friday block afternoon", "every investor mtg → prep block", "every flight → airport buffer", "every interview → follow-up") | ⬜ | **NEW — big** |
| **Event templates** (duration, buffers, reminders, links, follow-up) | ⬜ | **NEW** (email templates exist for workflows, not event templates) |
| **Smart rescheduling** (cancelled → focus; delayed → shift downstream) | ⬜ | **NEW** |

## Phase 6 — Intelligence Engine
| Capability | Status | Notes |
|---|---|---|
| Calendar analytics (meeting hours, focus, busiest day, by-type) | ✅ | Insights page + `/api/insights` |
| **Focus analytics** (context switching, fragmentation, deep-work consistency) | ⬜ | **NEW** |
| **Calendar-health detection** (unused recurring mtgs, repeated cancellations, late meetings, inefficiencies) | ⬜ | **NEW** — needs unified event model |
| **Recommendations** ("move customer calls to mornings", "protect Friday") | ⬜ | **NEW** |
| ⭐ **Calendar Memory** (learn habits → soft recommendations, never hard rules) | ⬜ | **NEW differentiator** |

## Phase 7 — Collaboration
| Capability | Status | Notes |
|---|---|---|
| Shared team calendar view · collective · round-robin · team event types | ✅ | the wedge |
| **Shared booking links** | ⬜ | **NEW** |
| **Team scheduling rules** (meeting-free afternoons, working agreements, company holidays, shared focus blocks) | ⬜ | **NEW** |

## Phase 8 — Mobile (companion, not reduced web)
| Capability | Status | Notes |
|---|---|---|
| Expo app: host mgmt, event types, availability, bookings, settings, calendar, insights, AI, channels, overflow | ✅ | typecheck + Metro-export verified |
| **Native push · widgets · live activities · offline · voice shortcuts** | ⬜ | needs `expo-notifications` + a dev build |
| Quick actions (running late, accept/decline, book, delay) | 🟡 | running-late + overflow shipped; rest ⬜ |

## Phase 9 — Public Platform
| Capability | Status | Notes |
|---|---|---|
| REST API (internal, bearer-authed for mobile) | ✅ | not a public contract |
| **API keys · outbound webhooks · SDK · Zapier · n8n · MCP server · browser extension · CLI** | ⬜ | **NEW** — the developer cluster |

## Phase 10 — Enterprise (deferred by owner)
Organizations ✅ · RBAC ✅ · audit logs ⬜ · SSO/SAML/SCIM ⬜ · admin dashboard ⬜ · billing ⬜ · self-hosting ✅ (Docker) · compliance ⬜. **Explicitly parked until earlier phases are excellent.**

---

## ⭐ Long-term differentiators (should shape architecture now)
| Differentiator | Status | Depends on |
|---|---|---|
| AI Meeting Overflow | 🟡 | manual today; auto-detect needs provider presence signals |
| **Calendar Memory** (habit learning) | ⬜ | unified event model + Intelligence engine |
| **Travel-Aware Scheduling** (travel time, airport buffers, hybrid locations) | ⬜ | unified event model + location data |
| **Adaptive Availability** (fewer slots on heavy weeks; auto-reserve focus when target missed) | ⬜ | Availability + Intelligence engines |
| **Calendar Inbox** (unified: pending invites, conflicts, expired links, broken sync, suggestions) | 🟡 | **v1 shipped** — `/inbox` composes sync-health (reconnect) + double-booking detection (via event model) + pending invites + focus suggestions. Add expired-links + optimization nudges next. |
| **Meeting Lifecycle** (scheduled→confirmed→reminded→joined→delayed→completed→follow-up→archived) with automation hooks | ⬜ | state machine on bookings + Automation engine |

---

## Highest-leverage NEW work this PRD surfaces (beyond the §-cluster list)
1. **Unified full event model** — ingest full events (not just busy times). Foundational; unlocks Planning, Intelligence, Calendar Inbox, personal events, travel-aware.
2. **Calendar Inbox** — one actionable surface for every pending scheduling action. Highest UX leverage.
3. **Automation Engine** — rules + templates + smart rescheduling. The Zapier-for-your-calendar wedge.
4. **Planning Engine** — schedule balancing + recurring/protected blocks + timeline + personal events.
5. **Intelligence Engine** — focus analytics + calendar-health recommendations + Calendar Memory.
6. **Calendar Engine hardening surfacing** — health dashboard, ICS import, calendar rename/visibility/read-only.
7. **Developer platform** — outbound webhooks, API keys, SDK, MCP server, extension, CLI.

## Reprioritization signal
The PRD says **Calendar Engine is the highest priority** — its robustness (unified event model, health, conflict resolution) should come before piling on more scheduling/AI features, since those sit on top of it. Recommend interleaving **engine-hardening** with the remaining feature clusters rather than a pure feature march.
