# How DayOtter compares

An honest look at where DayOtter fits among scheduling tools — including what we
**don't** do yet. If something here is out of date or wrong, please open an issue;
we'd rather be corrected than overclaim.

## The one-line difference

DayOtter is the only scheduler we know of that is **AI-native, open source (AGPLv3),
and fully self-hostable — including the AI — at the same time.** Every alternative
gives up at least one of those three.

## At a glance

| | DayOtter | Cal.com (Cal.diy, OSS) | Cal.com (cloud) | Calendly | Motion / Reclaim |
|---|---|---|---|---|---|
| License | **AGPLv3, all of it** | MIT, feature-stripped | Closed | Closed | Closed |
| Self-host the full product | **Yes** | Core only | License key required | No | No |
| AI assistant | **Yes — open, confirm-first** | No | Cal.ai (closed, metered) | No | Yes (closed) |
| Run the AI on your own box | **Yes — local model or BYO key** | — | No | — | No |
| Teams / round-robin | ✅ open | ❌ removed from OSS | 💲 paid | 💲 | — |
| Routing forms | ✅ open | ❌ removed | 💲 | — | — |
| Workflows / automations | ✅ open | ❌ removed | 💲 | limited | ✅ |
| Insights / analytics | ✅ open | ❌ removed | 💲 | 💲 | ✅ |
| Payments (Stripe) | ✅ open | ✅ | ✅ | 💲 | — |
| Mobile app | ✅ (Play; bring-your-own-server) | — | ✅ | ✅ | ✅ |
| SSO / SAML, SCIM, SOC 2 | 🚧 roadmap | ❌ | 💲 enterprise | enterprise | enterprise |
| Maturity & community | 🚧 **early** | large, established | same lineage | category leader | established |

✅ open · 💲 paid/closed · ❌ not available · 🚧 planned

## Context: what changed in 2026

- **Cal.com moved its core to closed source (~April 2026)**, leaving an MIT
  "Cal.diy" fork with Teams, Organizations, SAML/SCIM, Workflows, Routing Forms,
  Insights, and its AI agent removed. The features Cal.com pulled behind a closed
  wall are the ones DayOtter keeps open. ([cal.com blog](https://cal.com/blog/cal-com-goes-closed-source-why),
  [itsfoss](https://itsfoss.com/news/cal-com-goes-proprietary/))
- **The AI-scheduling incumbents are closed and consolidating.** Reclaim was
  acquired by Dropbox; Clockwise was acqui-hired by Salesforce and shut down in
  March 2026. Self-hosting is the only version of this you truly control.

## Where DayOtter is genuinely strong

- **Open, including the AI.** Otter's prompts, tools, and orchestration are all in
  the repo — not a rented black box.
- **The AI runs where you want it.** Local model (Ollama/vLLM) for zero phone-home,
  or a hosted key — your call. See [Self-hosting the AI](./AI.md#self-hosting-the-ai).
- **Confirm-first.** Otter proposes; you approve. It won't silently reshuffle your
  calendar (the thing people dislike about aggressive auto-schedulers).
- **Breadth that's open here** and paywalled/closed elsewhere: teams, routing,
  workflows, insights, payments, group polls, plugins, a mobile app.

## Where DayOtter is weak today (on purpose, being honest)

- **It's early.** Young project, small team, not yet proven at scale. Cal.com and
  Calendly have years and large communities.
- **AI needs a model.** The AI *code* is free; running it needs either a paid API
  key or a local GPU. Tiny local models give weaker results.
- **Enterprise/compliance is roadmap.** SSO/SAML, SCIM, audit logs, SOC 2/HIPAA are
  planned, not shipped ([roadmap](./ROADMAP.md)).
- **Smaller ecosystem.** We have a plugin SDK, but not (yet) a large app marketplace.

## Migrating in

- **From Calendly:** built-in importer (Settings → Import) pulls your event types
  and availability from a Calendly access token.
- **From Cal.com:** see the importer under Settings → Import.
