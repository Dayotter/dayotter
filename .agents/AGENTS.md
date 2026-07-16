# DayOtter - agent onboarding

You're working on **DayOtter**: an open-core, AI-native team-scheduling platform
(a genuinely-open Calendly/Cal.com alternative) at [dayotter.com](https://dayotter.com).
This file is the fast path to being productive. Read it, then load the relevant
skill under [`.claude/skills/`](../.claude/skills/) for the area you're touching.

## What this is

- **Monorepo** - Turborepo + pnpm. Apps in `apps/*`, shared logic in `packages/*`.
- **AGPLv3, self-host the whole product for free** - including every AI feature.
  A small `apps/web/lib/ee/` layer holds cloud-only infrastructure, inert unless
  `DAYOTTER_CLOUD=1`. Never move a core feature behind that flag.
- **API-first** - all domain logic lives in `packages/*`, never only in `apps/web`.
  Web and (upcoming) mobile are peer clients of a stable REST/OpenAPI surface.

## Layout

```
apps/web       Next.js 15 App Router (marketing + app + REST API routes)
apps/worker    BullMQ workers (calendar sync, reminders, briefings, webhooks, CRM)
apps/mobile    Expo/React Native (early)
packages/core        crypto, logger, SSRF (safeFetch), the availability engine
packages/db          Drizzle schema (split by domain) + migrations
packages/calendar    provider adapters (Google, Microsoft, CalDAV)
packages/integrations  adapters-for-connection, CRM (Salesforce/HubSpot)
packages/jobs        BullMQ queue definitions + connection
packages/notifications | emails | auth | plugin-host | plugin-sdk | plugins
```

## Build / test / verify - run before you claim done

```bash
pnpm turbo typecheck                 # all packages (15 projects)
pnpm --filter @dayotter/core test    # 30 tests incl. DST correctness
pnpm --filter @dayotter/web test     # ~85 tests (vitest)
npx biome check --write <files>      # format + lint (biome, not prettier/eslint)
```

Preview the web app via the launch config `web` (or `web-cloud` for the hosted
edition). Never start dev servers with a bare `pnpm dev` in a way that detaches -
use the preview tooling. Dev-mode home page can blank client-side during Fast
Refresh; SSR is complete, so it's a dev quirk, not a bug.

## Load-bearing invariants (do not violate)

1. **Timezone discipline.** Store instants in UTC (`timestamptz`); wall-clock
   values always carry an explicit IANA zone and are resolved through Luxon. The
   availability engine returns absolute instants; booker tz is presentation-only.
   DST is covered by `packages/core/src/availability/engine.test.ts` - keep green.
2. **Confirm-first AI.** AI proposes an editable draft; it never mutates the
   calendar without explicit user confirmation. AI scope is scheduling only.
3. **Secrets encrypted at rest.** OAuth tokens, phone numbers, channel configs →
   AES-256-GCM via `@dayotter/core` crypto (`ENCRYPTION_KEY`). Never log plaintext.
4. **Untrusted egress goes through `safeFetch`** (`@dayotter/core`) - HTTPS-only,
   DNS-resolved-IP pinned, no redirects. Webhooks, plugin HTTP, CRM calls use it.
5. **Single runtime.** The stack is I/O-bound; crypto is already native. An audit
   concluded **no Go/Rust** is warranted - don't add a second runtime.

## Editions - the flag that changes behavior

`DAYOTTER_CLOUD=1` (deploy-time, `apps/web/lib/billing/edition.ts` → `isCloud`)
switches self-hosted → cloud:
- **Self-hosted (default):** every Pro feature free, no billing. Billing settings
  show "everything unlocked." CRM/messaging/AI configured via env.
- **Cloud:** free tier + $9/seat Pro plan gate differentiators; `ee/` unlocks.

If billing shows "self-hosted" on a hosted deploy, the env flag isn't set - that's
config, not a code bug. See the `editions-and-billing` skill.

## Recent decisions log (newest first)

- **Analytics module** (Mixpanel + GA4 + PostHog) - `apps/web/lib/analytics.ts`.
  Two independent switches: per-provider env vars (deployer) + per-browser opt-out
  (end user, Settings → Preferences). All emit paths gate on `analyticsAllowed()`.
- **Calendar push is best-effort** - a failed Google `watch`/subscription must not
  fail the sync (`apps/worker/src/workers/sync.ts`); polling is the fallback.
- **Auth redirect** - the `(auth)` layout bounces signed-in users to `/dashboard`.
- **Perf/dedup audit (#33)** - availability engine uses integer-ms math; DB index
  `bookings(eventTypeId, startsAt)`; unified `safeFetch`; booking lifecycle fan-out
  (`apps/web/lib/booking/lifecycle.ts`); briefing worker dedup; CRM shared helpers.
- **Plugin/extension system (#32)** - in-process, config-listed plugins under
  `packages/plugins`, `plugin_data` storage, host registry. Only enable trusted ones.
- **Marketing width tiers** - 5xl (browse/hubs/detail), 3xl (articles/legal),
  6xl (home/pricing). Illustrations may carry baked light frames (dark-mode edges).

## Reference docs (human-facing, authoritative)

`docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/EDITIONS.md`, `docs/AI.md`,
`docs/ENTERPRISE.md`, `docs/SELF_HOSTING.md`, `docs/ROADMAP.md`. The skills in
`.claude/skills/` are the agent-oriented "how to work here" companions to these.
