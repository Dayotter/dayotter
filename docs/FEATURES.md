# dayotter - Feature Plan

> Open-source (permissive, Apache-2.0) team scheduling & calendar platform.
> Superset of Calendly / Cal.com / SavvyCal / Reclaim / Motion / Clockwise, with
> **shared team availability as a first-class primitive** as the core wedge.

## Priority tiers

- **P0 - MVP / core loop.** The minimum that proves the product: connect a calendar → set
  availability → someone books → event lands on the calendar → reminders fire. Multi-tenant foundation.
- **P1 - v1 launch.** Competitive and sellable: all three providers, team features (the wedge),
  workflows, video, payments, public booking polish.
- **P2 - post-launch / differentiators.** Smart scheduling, enterprise/security, deep integrations, analytics.

### The MVP golden path (P0)
`Sign up → create org → connect Google → set working hours → create a 30-min event type →
share public link → invitee books → event written to both calendars + ICS invite →
confirmation email → 1-day & 1-hour reminders fire → reschedule/cancel works.`

---

## 1. Calendar Sync & Connections
| Feature | Tier |
|---|---|
| Connect Google Calendar (OAuth) | P0 |
| Connect Microsoft / Outlook 365 (OAuth) | P0 |
| Connect Apple iCloud (CalDAV) | P1 |
| Two-way sync (bookings write back; external changes reflected) | P0 |
| Real-time updates via webhooks (Google `watch`, MS Graph subscriptions) | P0 |
| CalDAV poll + reconciliation (Apple has no webhooks) | P1 |
| Select which calendars count for conflict-checking (busy) | P0 |
| Select which calendar new bookings are written to | P0 |
| Correct recurring-event expansion (RRULE) | P0 |
| Multiple accounts per user (e.g. 2 Google + 1 work) | P1 |
| Free/busy-only mode (privacy: don't read event details) | P1 |
| Connection health status + auto token refresh / reconnect flow | P1 |
| Generic CalDAV (Fastmail, Nextcloud) | P2 |
| Delegated / shared external calendars | P2 |

## 2. Availability Engine
| Feature | Tier |
|---|---|
| Weekly working hours schedule | P0 |
| Timezone handling + auto-detect booker timezone | P0 |
| Availability computed across all connected calendars | P0 |
| Buffers before/after meetings | P0 |
| Minimum scheduling notice | P0 |
| Booking window / date range (e.g. up to 60 days out) | P0 |
| Multiple schedules (assign per event type) | P1 |
| Date-specific overrides (holidays, one-offs) | P1 |
| Daily/weekly booking limits (max meetings per day) | P1 |
| Minimum time between bookings | P1 |
| Slot interval / frequency (show every 15 / 30 min) | P1 |

## 3. Event Types (booking configuration)
| Feature | Tier |
|---|---|
| Create event types (name, duration, description, slug) | P0 |
| Location types: video, phone, in-person, custom | P0 |
| Custom booking questions / intake form | P1 |
| Multiple durations per event type | P1 |
| One-off / single-use booking links | P1 |
| Guest invites (booker adds +N guests) | P1 |
| Per-event-type booking limits | P1 |
| Confirmation page + redirect URL | P1 |
| Secret / private event types | P1 |
| Color, custom URL slug | P1 |
| Duplicate event type | P2 |

## 4. Public Booking Experience
| Feature | Tier |
|---|---|
| Public profile page (all event types) + per-event page | P0 |
| Mobile-responsive, fast booking flow | P0 |
| Booker timezone selector | P0 |
| Confirmation page | P0 |
| Reschedule link | P0 |
| Cancel link | P0 |
| Add to calendar (ICS / Google / Outlook) | P1 |
| Custom branding (logo, colors) | P1 |
| Embed widget (inline / popup / floating button) | P1 |
| i18n / multi-language | Partial (booking + Otter UI via `lib/i18n/locales/`) |
| SavvyCal-style: overlay booker's own calendar on the picker | P2 ⭐ |
| Ranked / preferred time slots | P2 ⭐ |

## 5. Team & Collaboration - **the wedge** ⭐
| Feature | Tier |
|---|---|
| Organization / team creation | P0 |
| Invite members, roles (owner / admin / member) | P0 |
| Shared team calendar view (see everyone's schedule) | P0 |
| Collective availability - "find time we're all free" | P1 ⭐ |
| Round-robin distribution (equal / weighted / by availability) | P1 ⭐ |
| Team event types (admin-managed, assigned to members) | P1 |
| Managed event types (admin pushes settings to members) | P2 |
| Shared availability schedules | P2 |
| Meeting pool / assignment rules | P2 |

## 6. Notifications, Reminders & Workflows
| Feature | Tier |
|---|---|
| Confirmation email to host + invitee | P0 |
| Calendar invite (ICS) with video link | P0 |
| Reminder email 1 day before | P0 |
| Reminder email 1 hour before | P0 |
| Reschedule / cancel notification emails | P0 |
| Configurable reminder timings | P1 |
| Follow-up email after meeting | P1 |
| Workflow builder (trigger → action → timing) | P1 |
| Custom email templates | P1 |
| **Multi-channel delivery** - user chooses per channel | - |
| &nbsp;&nbsp;• Mobile push (APNs / FCM) | P1 |
| &nbsp;&nbsp;• Slack | P2 |
| &nbsp;&nbsp;• WhatsApp | P2 |
| &nbsp;&nbsp;• SMS | P2 |
| No-show tracking | P2 |

> Reminders are part of the **scheduling** domain, not a separate area
> (`workflows` + `scheduled_reminders`). Delivery is channel-agnostic - the worker
> resolves each user's enabled `notification_channels` at send time.

## 7. Time Blocking & Smart Scheduling - differentiators (Motion / Reclaim) ⭐
| Feature | Tier |
|---|---|
| Manual time blocks | P1 |
| Focus time / do-not-schedule blocks | P2 |
| Auto-scheduling tasks into free slots | P2 ⭐ |
| Habits / recurring flexible blocks | P2 |
| Smart 1:1s (auto-find recurring slot for two people) | P2 ⭐ |
| Travel-time buffers | P2 |
| **Meeting-overflow "running late" nudge** ⭐ | P2 |
| Meeting cost / focus analytics (Clockwise-style) | P2 |

> **Overflow nudge:** at a meeting's scheduled end, if the calendar shows a
> back-to-back next meeting, offer a one-tap "I'm running late" that emails/pings
> the next meeting's attendees. Detected from `bookings` (no new provider calls).

## 8. Integrations
| Feature | Tier |
|---|---|
| Google Meet (native link generation) | P1 |
| Zoom | P1 |
| Microsoft Teams | P1 |
| Outbound webhooks | P1 |
| Slack notifications | P2 |
| Zapier / Make | P2 |
| CRM (HubSpot, Salesforce) | P2 |
| Contacts (Google / Outlook) | P2 |

## 9. Payments & Monetization (of bookings)
| Feature | Tier |
|---|---|
| Require payment to book (Stripe) | P1 |
| Deposits | P2 |
| Refunds on cancel | P2 |
| Multiple currencies | P2 |

## 10. Org, Admin & Multi-tenancy
| Feature | Tier |
|---|---|
| Multi-tenant data isolation | P0 |
| Member management + RBAC | P0 |
| Org settings & branding | P1 |
| Billing / subscription (hosted SaaS only) | P2 |
| Plan-based usage limits (hosted SaaS only) | P2 |
| Audit logs | P2 |
| SSO / SAML | P2 |
| SCIM provisioning | P2 |

## 11. Developer Platform / API
| Feature | Tier |
|---|---|
| REST API (event types, bookings, availability) + API keys | P1 |
| Outbound webhooks | P1 |
| Embed SDK | P1 |
| Public OAuth app platform (third-party apps) | P2 |

## 12. Analytics & Reporting
| Feature | Tier |
|---|---|
| Booking stats (created / completed / canceled) | P1 |
| Per-event-type metrics | P2 |
| Team utilization | P2 |
| Page-view → booking conversion | P2 |
| CSV export | P2 |

## 13. User Settings & Profile
| Feature | Tier |
|---|---|
| Profile (name, avatar, bio, timezone) + public handle | P0 |
| Connected apps management | P1 |
| Notification preferences | P1 |
| Theme (light / dark) | P2 |

## 14. Self-hosting & Operations
| Feature | Tier |
|---|---|
| One-command `docker compose up` deploy | P0 |
| Env-based configuration | P0 |
| DB migrations | P0 |
| Pluggable SMTP email | P1 |
| Health checks / observability | P1 |
| Backup & restore guidance | P2 |

---

## 15. AI (scheduling-scoped only) ⭐
> **Scope guardrail:** AI stays inside calendar & scheduling. We do **not** build
> general email writing, a general personal assistant, or non-calendar tasks.
> **Pattern (from Planif.ai): AI proposes an editable draft, the human confirms.**
> The AI never silently mutates the calendar. Details in [DECISIONS.md](DECISIONS.md#3-ai-scope--scheduling-only-confirm-first).

| Feature | Tier |
|---|---|
| Natural-language scheduling - "schedule a call with mom Friday afternoon" | P2 |
| NL → pre-filled, editable event/reminder draft (confirm before write) | P2 |
| Smart calendar blocking / deep-work protection around meetings | P2 |
| AI calendar-invite handling (accept / decline / propose new time) | P2 |
| Short, meeting-scoped invite replies ("can we push to 3pm?") | P2 |
| Multi-language NL understanding | P2 |

## 16. Design principles (UI must be clean & intuitive)
References: **Planif.ai** (minimal, color-coded, confirm-first AI) and **Todofi**
(multi-view, drag-and-drop, "see what's now, see what's next", zero-setup).

- Clean, minimal, color-coded. Clarity over feature bloat.
- Multiple calendar views: **day / month / agenda**, with drag-and-drop scheduling.
- A focused **"now / next"** view (also powers the overflow nudge).
- Mobile-first interactions (gestures, drag-drop) - see mobile note below.
- Meaningful analytics (where your time actually went), **no vanity metrics**.

## Mobile (Android + iOS) - structural readiness now
Native apps are planned. The codebase is kept **API-first**: all domain logic in
`packages/*`, a versioned REST/OpenAPI contract, token-based auth, shared Zod
DTOs, and push as a notification channel. See
[DECISIONS.md](DECISIONS.md#2-api-first--web-and-mobile-are-peer-clients).

## What P0 (MVP) explicitly includes
Sections 1–4, 6, 10, 13, 14 at their **P0** rows only, plus the shared team calendar view (section 5, P0).
That is a multi-tenant, self-hostable, single-user Calendly equivalent with a team calendar and working reminders.

## What makes us different (bet the roadmap on these ⭐)
1. **Team availability as a primitive** - collective "all free" + round-robin without a paywall (§5).
2. **Rock-solid timezone correctness** - no wrong-hour bookings, ever (DST-tested).
3. **Scheduling-scoped AI** - NL booking + smart blocking + invite handling, confirm-first (§15).
4. **The overflow "running late" nudge** - a small, delightful, unique touch (§7).
5. **Smart scheduling** - auto-scheduling & focus defense (§7).
6. **SavvyCal-grade booking UX** - overlay + ranked slots (§4).
