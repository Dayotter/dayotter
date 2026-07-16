---
name: dayotter-overview
description: Orientation for the DayOtter monorepo - layout, the single sources of truth (availability engine, sync worker), the load-bearing invariants (timezone discipline, confirm-first AI, encryption, SSRF-safe egress, single runtime), and how to build/test/verify. Load this first when starting work anywhere in the repo.
---

# DayOtter overview

Open-core, AI-native team scheduling. Turborepo + pnpm. AGPLv3 - the whole
product, including AI, self-hosts for free. Cloud-only infra lives in
`apps/web/lib/ee/`, inert unless `DAYOTTER_CLOUD=1`.

## Where code lives (API-first: domain logic in packages, never only in apps/web)

- `packages/core` - crypto (AES-256-GCM), logger, SSRF `safeFetch`, and the
  **availability engine** (`availability/engine.ts`, pure + unit-tested).
- `packages/db` - Drizzle schema split by domain + migrations (`drizzle/`).
- `packages/calendar` - provider adapters (Google / Microsoft / CalDAV).
- `packages/integrations` - `adapterForConnection`, CRM (Salesforce/HubSpot).
- `packages/jobs` - BullMQ queue names + Redis connection.
- `packages/{notifications,emails,auth,plugin-host,plugin-sdk,plugins}`.
- `apps/web` - Next.js 15 App Router: `(marketing)` + `(app)` + `(auth)` route
  groups and the REST API under `app/api`. Domain helpers in `apps/web/lib/*`.
- `apps/worker` - BullMQ workers: sync, reminders, briefings, webhooks, CRM sync.

Two **single sources of truth** everything else reads from:
- **Availability engine** - computes bookable slots from schedule + busy cache.
- **Sync worker** - projects provider calendars into the `busy_blocks` cache the
  engine reads. The engine never calls a provider directly.

## Invariants (enforced in review - see docs/DECISIONS.md)

1. **Timezone discipline.** UTC instants in the DB; wall-clock always carries an
   IANA zone, resolved through Luxon. Engine returns absolute instants; booker tz
   is presentation-only. DST is unit-tested - keep `engine.test.ts` green.
2. **Confirm-first AI, scheduling-scoped.** AI drafts an editable proposal; never
   silently mutates the calendar. No general assistant/email/task features.
3. **Encryption at rest.** OAuth tokens, phone numbers, channel configs via
   `@dayotter/core` crypto + `ENCRYPTION_KEY`. Plaintext never hits DB or logs.
4. **SSRF-safe egress.** All untrusted outbound HTTP uses `safeFetch` (HTTPS-only,
   resolved-IP pinned, no redirects).
5. **Single runtime.** I/O-bound stack, native crypto - audited: no Go/Rust.

## Verify before "done"

```bash
pnpm turbo typecheck
pnpm --filter @dayotter/core test   # 30, incl. DST
pnpm --filter @dayotter/web test    # ~85
npx biome check --write <files>     # biome - NOT prettier/eslint
```

Migrations: Drizzle, in `packages/db/drizzle` (numbered). Add schema in
`packages/db/src/schema/*`, generate a migration, don't hand-edit applied ones.

## Related skills

`editions-and-billing`, `calendar-availability`, `plugins-extensibility`,
`analytics`, `frontend-conventions`. Human docs: `docs/ARCHITECTURE.md`,
`docs/DECISIONS.md`.
