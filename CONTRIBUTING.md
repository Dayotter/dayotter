# Contributing to DayOtter

Thanks for helping build the open scheduling platform. This guide gets you from
zero to a merged PR.

## Code of conduct

By participating you agree to the [Code of Conduct](./CODE_OF_CONDUCT.md). Be
kind, be constructive.

## Ways to contribute

- **Report a bug** or **request a feature** → [open an issue](../../issues/new/choose).
- **Improve docs** - the fastest way to make a first contribution.
- **Fix a bug** or **build a feature** - grab an issue labelled `good first issue`
  or `help wanted`, or propose your own (see *Proposing a change* below).
- **Add to an extensible module** - the AI extractors, time-allocation metrics,
  voice knowledge sources, and reminder kinds are all registry-based; adding one
  is a great first PR. See each module's `README.md`.

## Before you start

For anything larger than a small fix, **open an issue first** so we can agree on
the approach before you invest time. Check the [Roadmap](./docs/ROADMAP.md) to
see if it's already planned.

## Development setup

Requirements: **Node 20+**, **pnpm 10+**, **Docker** (for Postgres + Redis).

```bash
git clone https://github.com/nometria/dayotter && cd dayotter
docker compose up -d            # Postgres + Redis
cp .env.example .env            # fill in what you need (most features degrade gracefully without creds)
pnpm install
pnpm db:push                    # create the schema
pnpm dev                        # web on :3000, worker in the background
```

You don't need every credential to start - Otter needs `ANTHROPIC_API_KEY`,
calendar sync needs OAuth creds, messaging needs Twilio, etc. Features that
aren't configured stay inert rather than crashing.

## Project layout

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full map. In short:
`apps/web` (Next.js + API + Otter), `apps/worker` (BullMQ jobs), `apps/mobile`
(Expo), `packages/*` (shared libs), `docs/*`.

## Making a change

1. **Branch** off `main`: `git checkout -b feat/short-name` (or `fix/`, `docs/`,
   `chore/`).
2. **Write it to match the surrounding code** - same patterns, naming, and
   comment density. We favour small, well-commented, self-explaining code.
3. **Keep it green:**
   ```bash
   pnpm turbo typecheck          # all packages must typecheck
   pnpm biome check --write .    # format + lint (or `pnpm lint`)
   ```
4. **Verify behaviour**, not just types - exercise the change end to end
   (drive the flow, hit the endpoint). Add tests where the repo has them
   (`packages/core` is unit-tested; add cases there for pure logic).
5. **Migrations:** if you touch `packages/db/src/schema/*`, run
   `pnpm --filter @dayotter/db generate` to create the SQL migration and commit
   it. Never hand-edit a generated migration.

## Commits & PRs

- **Conventional Commits:** `feat(scope): …`, `fix(scope): …`, `docs: …`,
  `refactor: …`, `chore: …`. The scope is the module (`ai`, `booking`, `voice`,
  `db`, …).
- **One logical change per PR.** Smaller PRs get reviewed faster.
- Fill in the PR template: what changed, why, and how you verified it. Link the
  issue (`Closes #123`).
- CI must be green (typecheck + lint). A maintainer will review; expect a couple
  of rounds of feedback.

## Licensing of contributions

- Contributions to the **open-source core** (everything outside `ee/`) are
  accepted under **AGPLv3** - the repo's license. By opening a PR you certify you
  wrote the code (or have the right to contribute it) and agree to license it
  under AGPLv3.
- The **`ee/`** directory is commercial (see [`apps/web/lib/ee/LICENSE.md`](./apps/web/lib/ee/LICENSE.md));
  most contributors never touch it, and PRs to it need explicit maintainer
  sign-off.

## Security

Please **don't** file security issues publicly. See [`SECURITY.md`](./SECURITY.md)
for private disclosure.

## Questions

Open a [discussion](../../discussions) or email hello@dayotter.com. Thank you 🦦
