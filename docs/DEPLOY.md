# Deploy DayOtter

DayOtter is two long-running services - **web** (Next.js) and **worker** (reminders,
calendar sync, briefings) - plus **Postgres** and **Redis**. Any host that can run
the two Dockerfiles (`apps/web/Dockerfile`, `apps/worker/Dockerfile`) with those two
data stores can run it.

> **AI is optional.** None of the buttons below require an AI key - DayOtter runs as
> a complete scheduler with no model configured. Add one later to turn Otter on
> ([Self-hosting the AI](./AI.md#self-hosting-the-ai)).

## The three values you always set

However you deploy, set these (the rest of `.env.example` is optional / feature-gated):

| Var | How to get it |
|---|---|
| `ENCRYPTION_KEY` | **64 hex chars:** `openssl rand -hex 32` (the all-zero placeholder is rejected) |
| `AUTH_SECRET` | 32+ random chars: `openssl rand -base64 32` |
| `APP_URL` + `NEXT_PUBLIC_APP_URL` | your public URL, e.g. `https://cal.acme.com`. `NEXT_PUBLIC_APP_URL` is **baked at build time**, so set it before/at build (or set it and redeploy). |

`DATABASE_URL` and `REDIS_URL` are wired up for you by the managed options below.

---

## One-click: Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Dayotter/dayotter)

Uses [`render.yaml`](../render.yaml) to provision web + worker + Postgres + Redis and
run migrations before each deploy. After the first deploy:

1. Set **`ENCRYPTION_KEY`** (`openssl rand -hex 32`) on both the web and worker services.
2. Set **`APP_URL`**, **`NEXT_PUBLIC_APP_URL`**, and **`BETTER_AUTH_URL`** to your
   assigned `https://<name>.onrender.com`, then **Manual Deploy → Clear build cache &
   deploy** so `NEXT_PUBLIC_APP_URL` is baked in.

> Render renamed "Redis" to "Key Value". If your account only offers `type: keyvalue`,
> change that one line in `render.yaml`.

## One-click: DigitalOcean App Platform

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/Dayotter/dayotter/tree/main)

Uses [`.do/deploy.template.yaml`](../.do/deploy.template.yaml) to provision web +
worker + Postgres + a **PRE_DEPLOY** migration job. During the create flow, set
`ENCRYPTION_KEY` and `AUTH_SECRET` (`openssl rand -hex 32` each) and, after the first
deploy, `APP_URL` / `NEXT_PUBLIC_APP_URL` / `BETTER_AUTH_URL` to your assigned
`https://<name>.ondigitalocean.app` (then redeploy so `NEXT_PUBLIC_APP_URL` bakes in).

> 💸 DigitalOcean has **no free Redis** - the template's `engine: REDIS` line
> provisions a paid managed **Valkey** cluster. If your account rejects `REDIS`, rename
> it to `VALKEY`. Postgres uses the free dev database (`production: false`).

## Fly.io

DayOtter runs as **two Fly apps** (web + worker ship different images). Configs live in
[`fly/`](../fly/); deploy from the repo root so the Docker build context is the whole
monorepo. Migrations run from the worker app's `release_command`, so **deploy the
worker first**:

```bash
fly postgres create --name dayotter-db          # managed Postgres
fly redis create                                # Upstash Redis - copy the redis:// URL

# worker (also runs migrations via release_command)
fly apps create dayotter-worker
fly postgres attach dayotter-db --app dayotter-worker
fly secrets set --app dayotter-worker REDIS_URL=redis://... \
  ENCRYPTION_KEY=$(openssl rand -hex 32) APP_URL=https://dayotter-web.fly.dev
fly deploy --config fly/fly.worker.toml

# web
fly apps create dayotter-web
fly postgres attach dayotter-db --app dayotter-web
fly secrets set --app dayotter-web REDIS_URL=redis://... \
  AUTH_SECRET=$(openssl rand -hex 32) ENCRYPTION_KEY=<same key as worker> \
  APP_URL=https://dayotter-web.fly.dev BETTER_AUTH_URL=https://dayotter-web.fly.dev
fly deploy --config fly/fly.web.toml
```

Use the **same** `ENCRYPTION_KEY` on both apps.

## One-click: Heroku

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/Dayotter/dayotter)

Uses [`app.json`](../app.json) + [`heroku.yml`](../heroku.yml) (container stack) to add
Postgres + Redis, run migrations in the **release phase** (worker image), and start the
web + worker dynos. `AUTH_SECRET` is auto-generated; set `ENCRYPTION_KEY` and the URL
vars when prompted.

> If the button errors on the container stack, deploy from the CLI instead:
> `heroku create → heroku stack:set container → git push heroku main`, then
> `heroku addons:create heroku-postgresql` and `heroku-redis`. `NEXT_PUBLIC_APP_URL`
> is baked at build time - set it and push again for client-side links to use it.

## Railway

Config-as-code lives in [`railway.web.json`](../railway.web.json) and
[`railway.worker.json`](../railway.worker.json) (a one-click Railway *button* must be
published from your own dashboard, so it can't ship in the repo):

1. New Project → Deploy from repo → add **two services**. In each service's settings set
   **Config-as-code Path** to `railway.web.json` (web) and `railway.worker.json`
   (worker). The worker config already runs migrations as its pre-deploy command.
2. Add the **Postgres** and **Redis** plugins; Railway injects `DATABASE_URL` /
   `REDIS_URL` - reference both on each service.
3. Set the three values above; expose the web service and use its domain as `APP_URL`.

## Coolify / CapRover / any Docker host

Use the production compose in [`deploy/`](../deploy/README.md) - it brings up Postgres,
Redis, migrations, web, worker, and a Caddy reverse proxy with automatic HTTPS:

```bash
git clone https://github.com/Dayotter/dayotter && cd dayotter/deploy
cp .env.example .env        # fill ENCRYPTION_KEY, AUTH_SECRET, DAYOTTER_DOMAIN, ...
./deploy.sh                 # builds, migrates, and starts everything
```

Coolify/CapRover can import that `docker-compose.prod.yml` directly.

---

**First boot is ~10 minutes.** Connect a Google/Microsoft/Apple calendar to see
conflict-free availability across all of them. OAuth client IDs for the calendars,
Stripe, Twilio, etc. are in [`docs/INTEGRATIONS.md`](./INTEGRATIONS.md).
