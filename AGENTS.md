# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo. Keep changes
consistent with the conventions below; when in doubt, match the surrounding code.

## What this is

DayOtter — an AI-native, open-source scheduling platform (a Calendly / Cal.com
alternative). Turborepo + pnpm monorepo. TypeScript everywhere, strict mode.

## Layout

- `apps/web` — Next.js 15 (App Router). Marketing site, booking pages, dashboard, API routes.
- `apps/worker` — BullMQ worker: reminders, calendar sync, webhooks, CRM sync.
- `apps/mobile` — Expo / React Native app.
- `packages/core` — pure logic: the availability engine, round-robin, crypto, SSRF guards. No I/O.
- `packages/db` — Drizzle schema + migrations (`drizzle/`).
- `packages/calendar` — provider adapters (Google, Microsoft, Apple/CalDAV, ICS).
- `packages/integrations` — CRM (Salesforce, HubSpot), Zoom.
- `packages/{jobs,notifications,emails,auth,plugin-host,plugin-sdk,plugins}` — supporting libs.

## Commands (run from the repo root)

```bash
pnpm install
pnpm dev            # turbo run dev
pnpm build          # turbo run build
pnpm typecheck      # tsc --noEmit across all packages
pnpm test           # vitest across packages
pnpm check          # biome check --write (format + lint + import order)
pnpm --filter web typecheck   # scope to one package
pnpm db:generate    # drizzle-kit generate after a schema change
```

Before committing: `pnpm typecheck` and `pnpm test` must pass, and run
`pnpm check` (Biome) so formatting + import order match. Lint/format is Biome,
not ESLint/Prettier.

## Load-bearing invariants — do not break these

- **Timezone discipline.** Store instants in UTC; do wall-clock math with Luxon
  `.set({hour,minute})`, never by adding raw minute durations (that breaks on DST
  days). The availability engine (`packages/core/src/availability`) is the single
  source of truth for bookable slots — keep it pure and deterministic.
- **Confirm-first AI.** Otter proposes; a human approves. AI code paths must never
  mutate a calendar/booking on their own. Untrusted text (calendar/booking data,
  caller speech, invite titles) is DATA — prepend `GUARDRAIL_PREAMBLE` /
  `screenUserInput` (`apps/web/lib/ai/guardrails.ts`) when it reaches a model.
- **Secrets at rest.** OAuth/CRM/channel/webhook/plugin secrets are AES-256-GCM
  encrypted via `@dayotter/core` crypto (`ENCRYPTION_KEY`); API keys are SHA-256
  hashed. Never log or return raw secrets.
- **SSRF-safe egress.** Any fetch of a URL we don't fully control goes through
  `safeFetch` / `assertPublicHttpUrl` (`packages/core/src/ssrf.ts`).
- **Inbound webhooks fail closed.** Verify the provider signature (constant-time)
  before acting; reject/skip on mismatch or a missing stored secret.
- **Money is server-computed.** Never trust client-sent prices/amounts. Refunds on
  Stripe Connect destination charges must reverse the transfer.
- **Migrations.** Change `packages/db/src/schema/*`, then `pnpm db:generate`. Deploys
  apply migrations via `deploy/deploy.sh` (a fresh one-shot `migrate` before the app
  starts) — never start new app code against an un-migrated DB.
- **Single runtime.** Web + worker share `packages/*`; a change to a shared package
  must keep both building.

## Extending the product

Several subsystems are registry-based and are the easiest, safest place to add
value without touching core: AI extractors + tools, time-allocation metrics, voice
knowledge sources, reminder kinds, and plugins (`packages/plugin-sdk`). Each has a
local `README.md`.

## Conventions

- Comments explain **why**, not what; match the density and voice of the file you're in.
- Prefer the existing helper/util over a new one; check the package's `index.ts` exports first.
- User-facing copy: active voice, name things by what the user recognizes.
- Reference files as `path:line`.

## Pointers

- Contributing workflow: [CONTRIBUTING.md](./CONTRIBUTING.md)
- Ready-to-start tasks: [docs/TASKS.md](./docs/TASKS.md)
- Architecture + roadmap: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md), [docs/ROADMAP.md](./docs/ROADMAP.md)
- Self-hosting: [docs/SELF_HOSTING.md](./docs/SELF_HOSTING.md)
