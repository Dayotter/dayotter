<div align="center">

# DayOtter

**The AI-native, open-source scheduling platform.**
Say it once — Otter books the meeting, protects your focus, and clears the back-and-forth. Confirm-first, always.

[Website](https://dayotter.com) · [Docs](./docs) · [Roadmap](./docs/ROADMAP.md) · [AI architecture](./docs/AI.md) · [Contributing](./CONTRIBUTING.md)

![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)
![Self-hostable](https://img.shields.io/badge/self--hostable-yes-brightgreen)
![Made with TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)

</div>

---

## Why DayOtter

Calendly is closed and cloud-only. **[Cal.com moved its core to a closed repo in April 2026](https://cal.com/blog/cal-diy-open-source-to-closed-source)** — citing AI — leaving only a stripped-down MIT fork with the commercial features removed. Motion and Reclaim were never open at all.

DayOtter is the alternative that stays genuinely open: **AGPLv3, self-host the _whole_ product** — including every AI feature — for free, forever. Not a demo, not a stripped fork.

And it's built around **Otter**, a confirm-first AI executive assistant that actually does the scheduling work, not just shares a link:

- Talk to it — in the app, by voice, or over **WhatsApp / SMS**.
- It **protects your focus time**, warns your next meeting when you're **running late**, and proactively **notices things worth doing**.
- It **learns your patterns** over time.
- It **never touches your calendar without your OK.**

## Features

**Scheduling** · unlimited event types & booking pages · Google / Microsoft 365 / Apple (CalDAV) / ICS calendar sync · availability engine with buffers, notice, timezones · recurring meetings · group polls · accept payments (Stripe) · prepaid session packages

**Teams** · weighted round-robin & collective booking · routing forms · shared availability · per-seat billing

**Otter (AI)** · natural-language command bar · voice input (mobile) · **inbound WhatsApp/SMS** · **AI voice receptionist** (24/7 phone line) · focus auto-scheduling · running-late overflow alerts · **proactive suggestions** · **long-term memory** · post-meeting recap. See [`docs/AI.md`](./docs/AI.md).

**Insight** · booking analytics + "where your time goes" time-allocation · CSV export

**Platform** · multi-channel reminders (email, Slack, WhatsApp, SMS, push) · automations & workflows · API keys & webhooks · mobile app (Expo, iOS + Android)

## Open-core

DayOtter is **open-core**, the way Cal.com _used to be_:

- **Everything outside `ee/` is AGPLv3** — the whole product, including all of Otter's AI. Self-host it and pay nothing.
- **`ee/` is a small, separately-licensed commercial layer** for *cloud-only infrastructure* — Managed AI (no key to configure), SSO, white-label, hosted messaging. It's inert unless `DAYOTTER_CLOUD=1`. See [`apps/web/lib/ee/LICENSE.md`](./apps/web/lib/ee/LICENSE.md) and [`docs/ENTERPRISE.md`](./docs/ENTERPRISE.md).

You do **not** need `ee/` to run the full product.

## Monorepo layout

```
apps/
  web       Next.js 15 — dashboard, public booking pages, REST API, Otter
  worker    Node + BullMQ — reminders, calendar sync, briefings, scribe
  mobile    Expo (React Native) — iOS + Android
packages/
  core          availability engine, round-robin, crypto (pure, unit-tested)
  db            Drizzle schema + Postgres client
  jobs          BullMQ queue contracts (shared producer/consumer)
  calendar      Google / Microsoft / Apple adapters behind one interface
  integrations  provider OAuth + sync
  notifications multi-channel delivery (Slack, Twilio, Expo/web push)
  emails        transactional email (Resend / SMTP)
  auth          Better Auth config (email, Google, phone/OTP)
```

Full breakdown: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Quick start (development)

```bash
# 1. Datastores (Postgres + Redis)
docker compose up -d

# 2. Config — fill in OAuth creds + generate secrets
cp .env.example .env

# 3. Install & create the schema
pnpm install
pnpm db:push

# 4. Run web (:3000) + worker
pnpm dev
```

**Stack:** TypeScript · Next.js 15 · Postgres + Drizzle · Redis + BullMQ · Luxon · Anthropic (Otter) · Better Auth · Stripe · Twilio.

## Self-hosting (production)

Docker Compose brings up Postgres, Redis, migrations, web, worker, and a reverse proxy. See [`deploy/README.md`](./deploy/README.md) and [`docs/SELF_HOSTING.md`](./docs/SELF_HOSTING.md). Redeploys always run migrations via [`deploy/deploy.sh`](./deploy/deploy.sh).

## Contributing

We'd love your help — see [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup, conventions, and the PR flow, and [`docs/ROADMAP.md`](./docs/ROADMAP.md) for where we're headed. Good first issues are labelled on the tracker. By contributing, you agree your changes are licensed under AGPLv3 (or the EE license for `ee/`).

- [Report a bug or request a feature](../../issues/new/choose)
- [Security policy](./SECURITY.md) · [Code of conduct](./CODE_OF_CONDUCT.md)

## License

- **Core:** [GNU AGPLv3](./LICENSE) — free to use, self-host, modify, and share.
- **`ee/`:** [DayOtter Enterprise Edition License](./apps/web/lib/ee/LICENSE.md) — commercial, cloud-only.

© DayOtter. "Otter" and "DayOtter" are trademarks; the AGPL covers the code, not the brand.
