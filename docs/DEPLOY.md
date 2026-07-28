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

## Railway

Railway builds each service straight from its Dockerfile. There's no committed template
(a Railway template is published from the Railway dashboard, not the repo), so:

1. New Project → Deploy from repo → add **two services** pointing at
   `apps/web/Dockerfile` and `apps/worker/Dockerfile`.
2. Add the **Postgres** and **Redis** plugins; Railway injects `DATABASE_URL` /
   `REDIS_URL` - reference them on both services.
3. Set the three values above; expose the web service and use its domain as `APP_URL`.

*(Want a one-click Railway button? Publish a template from your deployed project and
drop the `https://railway.com/new/template?...` URL into this file.)*

## DigitalOcean App Platform

Create an App from this repo with two **Dockerfile** components (web + worker), a
**Dev/Managed Postgres** and a **Managed Redis (Valkey)**; bind `DATABASE_URL` /
`REDIS_URL` and set the three values above. Run `pnpm --filter @dayotter/db migrate`
as a pre-deploy job.

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
