# calSync

Open-source team scheduling & calendar platform. Sync every calendar (Google,
Microsoft 365, Apple), share availability across your team, let people book you,
and get automatic reminders before every call.

Apache-2.0 licensed — self-host it, or use the hosted cloud.

## Why

Founders and teams overpay for scheduling tools that still can't handle multiple
calendars or shared team availability well. calSync treats **shared team
availability as a first-class primitive** (collective + round-robin, no paywall)
and unifies all your calendars into one source of truth.

## Monorepo layout

```
apps/
  web       Next.js — dashboard, public booking pages, REST API
  worker    Node — BullMQ workers: reminders + calendar sync
packages/
  core      availability engine, round-robin, token crypto (pure, unit-tested)
  calendar  provider adapters: Google, Microsoft, Apple (CalDAV) behind one interface
  db        Drizzle schema + Postgres client
```

## Stack

TypeScript everywhere · Next.js 15 · Postgres + Drizzle · Redis + BullMQ ·
Luxon (timezones) · googleapis / Microsoft Graph / tsdav (CalDAV).

## Quick start (development)

```bash
# 1. Datastores
docker compose up -d          # Postgres + Redis

# 2. Config
cp .env.example .env          # fill in OAuth creds + generate secrets

# 3. Install & migrate
pnpm install
pnpm db:push                  # create schema

# 4. Run
pnpm dev                      # web (:3000) + worker
```

Generate secrets:

```bash
openssl rand -base64 32       # AUTH_SECRET
openssl rand -hex 32          # ENCRYPTION_KEY (32-byte token-encryption key)
```

## Testing

```bash
pnpm test                     # runs the core availability + crypto test suites
```

## Status

Early foundation. Working today: monorepo, full data model, the availability
engine (unit-tested), provider adapters, background workers (reminders + sync),
and the availability REST endpoint. See [docs/FEATURES.md](docs/FEATURES.md) for
the full roadmap and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits
together.
