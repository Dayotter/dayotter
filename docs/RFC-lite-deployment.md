# RFC: Lite deployment (SQLite / no-Redis / no-Docker)

**Status:** Draft for review · **Author:** engineering · **Scope:** self-hosting only

## 1. Motivation

A user asked to run DayOtter on a very small VPS: SQLite instead of Postgres, no
Redis, and ideally no Docker. Today the stack hard-requires **Postgres + Redis**,
and the compose file also runs a separate **worker** process. The goal is a
**"lite" profile** a hobbyist can run on a 1-vCPU / 1 GB box, alongside the
existing **"standard" profile** (Postgres + Redis + worker) which stays the
default and the only one we recommend for teams.

Two deliverables, independently shippable:

- **Lite-with-Docker** — one container, SQLite file on a mounted volume, no Redis.
- **Lite-without-Docker** — the same, run as plain Node processes via a script.

Non-goals: changing the standard profile's behavior; supporting SQLite for
multi-node / high-concurrency; a managed-cloud SQLite option.

## 2. What blocks it today (from a code audit)

| Area | Current state | Blocker |
|---|---|---|
| DB driver | `drizzle-orm/node-postgres` + `pg`, dialect fixed to `postgresql` (`packages/db/src/client.ts`, `drizzle.config.ts`) | Compile-time Postgres; no runtime datastore switch |
| Schema | 50 `pgTable`s, 123 `uuid` PKs w/ `gen_random_uuid()`, 16 `jsonb`, 31 `timestamptz` | Types are Postgres-shaped; need a SQLite variant |
| **Double-booking guard** | **GiST exclusion constraint** `EXCLUDE USING gist (host_id =, tstzrange(starts_at,ends_at) &&)` (`drizzle/0019`, widened in `0024`/`0048`); caught as `23P01`/`23505` in `confirm-booking.ts` / `reschedule-booking.ts` | **SQLite cannot express this.** This is the #1 correctness risk. |
| App SQL | `::int`/`::text` casts, `FILTER (WHERE …)`, `ON CONFLICT` in `lib/booking/*`, `analytics.ts`, sync/CRM upserts | Casts are Postgres-only; `ON CONFLICT` + partial indexes + `FILTER` port to SQLite |
| Queue / cron | BullMQ over Redis (`packages/jobs`), 5 queues, delayed reminders, repeatable maintenance tick, Redis heartbeat + rate limiter | Entire job layer is Redis-native; no non-Redis path |
| Worker | Separate process (`apps/worker`) | Fine to keep, or fold in-process for lite |
| Health | `/api/health` returns 503 unless `db && redis` | Must relax when Redis is absent |
| Docker | `docker-compose.yml` runs postgres + redis + web + worker | Need a lite compose + a no-docker runbook |

Effort ranking: **no-Docker = ~free**, **SQLite = moderate + a real correctness
task**, **no-Redis = the largest lift**.

## 3. Proposed design

Introduce two seams (datastore + queue) selected by env, defaulting to today's
behavior so the standard profile is untouched.

### 3.1 Datastore seam

- Add `DB_DRIVER = postgres | sqlite` (default `postgres`).
- `packages/db/src/client.ts` becomes a factory: `postgres` → `drizzle-orm/node-postgres` (unchanged); `sqlite` → `drizzle-orm/libsql` (libsql supports a local file *and* a future hosted URL).
- Maintain a **parallel SQLite schema** generated from the same logical model. Column mapping: `uuid` → `text` (app generates UUIDs, already true for most inserts via `defaultRandom` → replace with a portable default), `jsonb` → `text` with a JSON codec, `timestamptz` → `integer` epoch-ms (Drizzle `timestamp_ms` mode) for correct ordering. Keep a **separate migration folder** (`drizzle/sqlite/`) so the two dialects don't fight; `drizzle-kit generate` runs per-dialect.
- **Double-booking without GiST (critical):** replace the DB-level exclusion with an application-level guard used *only* on the SQLite path:
  1. Keep the partial unique index on `(host_id, starts_at)` (already ports) as a cheap exact-collision catch.
  2. Wrap booking confirm/reschedule in a transaction that `SELECT`s overlapping confirmed rows for the host and aborts on any hit. SQLite is single-writer (a write transaction takes a database lock), so a serialized check is race-free within one node — which is exactly the lite target. Centralize this so `confirm-booking.ts` / `reschedule-booking.ts` call one `assertNoOverlap(tx, …)` helper instead of catching `23P01`.
  - This logic is guarded behind `DB_DRIVER === "sqlite"`; Postgres keeps the GiST constraint (strictly stronger).
- Remove/replace Postgres-only SQL (`::int` casts, `FILTER`) with dialect-neutral Drizzle expressions or a small `dbCast()` helper.

### 3.2 Queue seam

- Add `QUEUE_DRIVER = bullmq | inline` (default `bullmq`).
- Define a small `Queue`/`Scheduler` interface in `packages/jobs` with two impls:
  - **bullmq** — today's Redis-backed queues (unchanged).
  - **inline** — a DB-backed job table + a `setInterval` poll loop for delayed/repeatable jobs, run **in-process** inside the web server for lite (no separate worker, no Redis). Durable delayed reminders become rows with a `run_at`; the poll claims due rows with a transactional `UPDATE … RETURNING`-style guard.
- Replace the Redis rate limiter with an in-memory fixed-window limiter when `inline` (single node → correct); it already fails open, so this is low-risk.
- `/api/health`: report Redis only when `QUEUE_DRIVER=bullmq`.

### 3.3 Packaging

- `deploy/compose.lite.yml` — single `web` container, `DB_DRIVER=sqlite`, `QUEUE_DRIVER=inline`, SQLite file on a named volume, no postgres/redis services.
- `docs/SELF_HOSTING.md` gains a **Lite (no Docker)** section: `pnpm build`, run the Next standalone server with the lite env, data in `./data/dayotter.db`.

## 4. Phased plan

1. **Phase 0 — No-Docker runbook (ship first, ~free).** Document running web+worker as Node processes against managed Postgres/Redis. No code changes. Delivers the "no Docker" ask immediately and de-risks the rest.
2. **Phase 1 — Seams, no behavior change.** Introduce `DB_DRIVER`/`QUEUE_DRIVER` env + factories; standard profile still selects postgres+bullmq. Pure refactor, fully covered by existing tests.
3. **Phase 2 — SQLite datastore.** SQLite schema + `drizzle/sqlite/` migrations + the `assertNoOverlap` guard + cast cleanup. **Gate: a booking-overlap test suite that runs against *both* drivers** and proves no double-book under concurrent confirms.
4. **Phase 3 — Inline queue.** DB-backed scheduler + in-process runner + in-memory rate limit + health relax. Port each of the 5 job types; keep BullMQ as default.
5. **Phase 4 — Lite packaging.** `compose.lite.yml` + docs + a smoke test that boots the lite image, books a meeting, fires a reminder, all on SQLite with no Redis.

## 5. Risks & mitigations

- **Double-booking correctness (highest).** Mitigated by the transactional overlap check + the dual-driver test gate in Phase 2. Do not ship SQLite without it.
- **SQLite single-writer concurrency.** Acceptable for the lite target (small, single-node). Document it explicitly; steer teams to the standard profile.
- **Migration divergence** between the two dialects. Mitigated by generating both from one logical schema and CI that runs both migration sets on a fresh DB.
- **Feature drift.** Anything that later reaches for a Postgres-only feature must add a SQLite path or be gated off on lite. Add a CI job that typechecks + runs the suite with `DB_DRIVER=sqlite`.

## 6. Recommendation

Ship **Phase 0 now** (it fully satisfies "no Docker" and helps every self-hoster).
Land **Phases 1–4** behind the env flags so the standard profile is never at
risk, treating the **overlap guard + dual-driver booking tests as the gating
deliverable**. Estimated effort: Phase 0 ≈ hours; Phases 1–2 ≈ the bulk of the
work; Phases 3–4 ≈ a follow-up once SQLite is proven.
