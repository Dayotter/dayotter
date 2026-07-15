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
✅ automations & workflows (unified) · ✅ daily morning briefing · ✅ API keys &
webhooks · ✅ mobile app (Expo, iOS + Android)

## Now (in progress / next up)

- 🟡 **Native CRM (beta → GA)** - harden Salesforce / HubSpot sync, add field
  mapping and CRM-side routing
- 🟡 **Real Scribe** - Zoom/Meet transcription → summary + action items
- ⬜ **Team briefings** - a shared daily digest, not just personal
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

---

## How we prioritize

1. **Depth over breadth** - make Otter genuinely useful before adding surface.
2. **Confirm-first, always** - no feature breaks the "Otter proposes, you confirm"
   invariant.
3. **Open first** - capability lands in the open core; only cloud-only
   *infrastructure* goes in `ee/`.

Want something moved up? 👍 the issue, or better yet, send a PR - see
[`CONTRIBUTING.md`](../CONTRIBUTING.md).
