# Roadmap

Where DayOtter is and where it's going. This is a living document - open an
[issue](../../issues/new/choose) to propose something, and check
[Discussions](../../discussions) for what's being debated.

**Legend:** ✅ shipped · 🟡 partial · ⬜ planned · ⭐ differentiator

---

## Shipped

**Scheduling core** - ✅ unlimited event types & booking pages · ✅ Google /
Microsoft 365 / Apple (CalDAV) / ICS sync · ✅ availability engine (buffers,
notice, timezones, DST) · ✅ recurring meetings · ✅ group polls · ✅ accept
payments (Stripe) · ✅ prepaid session packages

**Teams** - ✅ ⭐ weighted round-robin & collective · ✅ routing forms · ✅ shared
availability · ✅ per-seat billing

**Otter (AI)** - ✅ ⭐ confirm-first command bar · ✅ voice input (mobile) ·
✅ ⭐ inbound WhatsApp/SMS · ✅ ⭐ AI voice receptionist · ✅ ⭐ focus
auto-scheduling · ✅ running-late overflow alerts · ✅ ⭐ proactive suggestions ·
✅ ⭐ long-term memory · 🟡 post-meeting recap (recap nudge; transcription pending)

**Insight** - ✅ booking analytics + funnel · ✅ ⭐ "where your time goes"
(meeting/focus balance, top people, time-of-day, weekly load, back-to-back share,
longest focus streak, external-vs-internal)

**CRM** - 🟡 ⭐ native Salesforce & HubSpot sync (beta) - contact + meeting logged
per booking, kept in sync on reschedule/cancel

**Platform** - ✅ multi-channel reminders (email/Slack/WhatsApp/SMS/push) ·
✅ automations & workflows (unified) · ✅ daily morning briefing · ✅ shared team
briefings · ✅ API keys & webhooks · ✅ mobile app (Expo - Android live on Google Play, iOS in progress)

## Now (in progress / next up)

- 🟡 **Native CRM (beta → GA)** - harden Salesforce / HubSpot sync, add field
  mapping and CRM-side routing
- 🟡 **Real Scribe** - Zoom/Meet transcription → summary + action items
- 🟡 **Deeper time analytics** - shipped back-to-back share, focus streaks,
  external-vs-internal; next: reclaimed time, recurring load

## Next

- 🟡 **Plugin / extension system** - `@dayotter/plugin-sdk` + host let anyone add
  Otter tools, booking hooks, and connectors without forking (v1: notes +
  webhook-relay reference plugins; next: settings UI, metric/memory contributions,
  optional sandboxing)
- ⬜ **Zapier app + integration directory** - beyond raw webhooks
- ⬜ **Otter memory depth** - more learned patterns; preference capture in-chat
- ⬜ **Voice receptionist v2** - conversational booking, transcripts, multi-tenant
- ⬜ **Self-host SSO** - a SAML/OIDC connector for self-hosters
- ⬜ **CRM-grade routing** - Otter-understood enquiry routing

## Later (vision)

- ⬜ ⭐ **Proactive weekly planning** - Otter drafts your week (focus blocks,
  batched meetings), confirm-first, learning from what you accept
- ⬜ **Multi-model / local AI** - first-class self-hosted model support for a
  fully private Otter
- ⬜ **AI evaluation harness** - scenario tests to keep Otter accurate across
  model/prompt changes

See [`AI.md`](./AI.md) for the detailed AI roadmap and how to contribute to it.

## Considering (backlog)

Bigger asks we've heard but haven't scheduled. Not commitments, and kept here
rather than as open issues so the tracker stays focused on actionable work. 👍 in
a [Discussion](../../discussions) or send a PR to pull one forward.

- **Booking** - booker email/phone verification before a booking sticks · instant
  "meet now" meetings · dynamic group booking (combine several people's links)
- **Teams** - managed event types (org templates pushed to members)
- **Integrations** - more calendars (Exchange on-prem, Lark, Zoho) · more CRM
  (Pipedrive, Close, Attio, Zoho) · more payments (PayPal, BTCPay) · automation
  apps (Zapier, Make, n8n)
- **Video** - more providers (Whereby, …) · native video (recording,
  transcription, AI summaries)
- **Routing** - attribute / CRM-ownership routing
- **Platform & API** - public REST API v2 · platform OAuth clients + managed users
- **Security & compliance** - audit logs · RBAC / custom roles · SCIM directory
  sync · domain-wide delegation · booking-page abuse prevention
  (watchlist/blocklist/bot detection) · compliance posture (SOC 2 / HIPAA / ISO
  27001)
- **Branding & i18n** - custom CSS booking-page branding · more locales (dozens)

---

## How we prioritize

1. **Depth over breadth** - make Otter genuinely useful before adding surface.
2. **Confirm-first, always** - no feature breaks the "Otter proposes, you confirm"
   invariant.
3. **Open first** - capability lands in the open core; only cloud-only
   *infrastructure* goes in `ee/`.

Want something moved up? 👍 the issue, or better yet, send a PR - see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).
