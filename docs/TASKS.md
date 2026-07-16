# Open tasks — help wanted

Concrete, scoped work that's ready to pick up. Each item says **where** to look and
**what "done" means**, so you can go straight from reading to a PR.

**How to claim one:** comment on (or open) the matching
[issue](../../issues) so we don't double up, then open a PR that references it.
For anything larger than a small fix, sketch the approach in the issue first — see
[CONTRIBUTING](../CONTRIBUTING.md). Forward-looking product direction lives in the
[Roadmap](./ROADMAP.md); this file is the near-term engineering backlog.

Difficulty: 🟢 good first issue · 🟡 medium · 🔴 involved / needs a design call.

---

## Developer experience

### 🟢 Silence the Redis `ECONNREFUSED` during `next build`
`packages/jobs/src/index.ts` creates the ioredis client at module load, so `next
build` (which imports server modules) tries to connect to Redis and logs
`ECONNREFUSED 127.0.0.1:6379`. The build still succeeds — it's just noise.
- **Do:** add `lazyConnect: true` to the `new IORedis(...)` options so it connects
  on first command instead of at import.
- **Done when:** a clean `pnpm --filter @dayotter/web build` shows no Redis errors,
  and queues/heartbeat still work at runtime (worker enqueues/consumes).

### 🟢 Add `CONTACT_EMAIL` to the deploy env example
The contact form (`apps/web/app/api/contact/route.ts`) sends to `CONTACT_EMAIL`
(default `hello@dayotter.com`), but that var isn't documented in
`deploy/.env.prod.example` or `.env.example`.
- **Done when:** both example files list `CONTACT_EMAIL` with a comment.

---

## Reliability / correctness

### 🟡 Make the contact form not lose messages on a mail failure
`apps/web/app/api/contact/route.ts` swallows send errors and still returns
`{ ok: true }`, so a failed send is silently lost (only a log line).
- **Do:** persist submissions to a small `contact_messages` table (new Drizzle
  table + migration) before/independently of the email, and/or return a real error
  to the client when the send fails.
- **Done when:** a submission survives an email outage (row is stored) and the UI
  reflects a genuine failure instead of a false "Thanks".

### 🟡 Per-occurrence availability + cap checks for recurring series
`apps/web/lib/booking/create-booking.ts` creates occurrences 2..N at a fixed
cadence; they're skipped only on a same-host DB collision, and daily/weekly/focus
caps aren't re-checked per occurrence. (Webhooks/CRM/workflows/overflow/scribe/
travel now DO fire per occurrence.)
- **Do:** decide + implement a policy — e.g. skip an occurrence that conflicts with
  an external busy block or would exceed a cap, logging what was skipped, and
  surface skipped dates to the booker/host.
- **Done when:** a recurring booking that lands on a busy week no longer
  double-books, and skipped occurrences are visible rather than silent.

### 🔴 Whole-series *reschedule*
Whole-series **cancel** exists (`cancelBookingSeries`), but reschedule only moves a
single occurrence (`apps/web/lib/booking/reschedule-booking.ts`).
- **Needs a design call first:** what does "reschedule the series" mean — shift
  every future occurrence by the same delta, or move to a new weekday/time and
  regenerate? Propose in an issue before coding.

---

## AI

### 🟡 Wire up user-stated memory (`rememberUserFact`)
`apps/web/lib/ai/memory/index.ts` exports `rememberUserFact` (source = "user") but
nothing calls it — only *derived* memory is written today.
- **Do:** add an intent/tool so when a user tells Otter "remember that I …", the
  fact is stored via `rememberUserFact`. See `lib/ai/tools/registry.ts` for the
  tool pattern.
- **Done when:** a stated preference persists and shows up in later context.

### 🟡 Cost ceiling for the public booking assistant
`apps/web/app/api/public/booking-assistant/route.ts` rate-limits per IP only. Add a
per-host and/or global daily ceiling on the LLM calls so an abusive booking page
can't run up unbounded model spend.

---

## Payments

### 🟢 Per-currency withdraw minimum (only matters for 0-decimal currencies)
`WITHDRAW_MINIMUM` in `apps/web/lib/payments/stripe.ts` is `10_000` minor units,
compared the same for every currency. Fine today (all six supported currencies are
2-decimal → 100.00 each), but if a 0-decimal currency (e.g. JPY) is ever added, the
minimum would be wrong.
- **Do:** turn it into a per-currency map / helper and use it in the withdraw route
  + payouts UI.

---

## Testing

### 🟡 Cover the untested money + auth + sync paths
No tests currently exercise: `lib/payments/stripe.ts`, the withdraw route, checkout
/ credits, the Stripe webhook, auth/session, or the sync worker
(`apps/worker/src/workers/sync.ts`) — and there are no API route-handler tests,
including the `/api/book` double-book guard.
- **Do:** add focused unit/integration tests for any one of these (each is its own
  good PR). Follow the existing Vitest setup under `apps/web/lib/**/*.test.ts`.

---

Don't see your idea here? Open an [issue](../../issues/new/choose) — new proposals
are welcome.
