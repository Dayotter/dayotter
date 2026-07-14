# Self-hosting DayOtter

Run the whole product — including all of Otter's AI — on your own infrastructure,
free, under AGPLv3. This is the setup guide.

## Requirements

- **Node 20+** and **pnpm 10+** (for local/dev) — or just **Docker** (for prod)
- **Postgres 15+** and **Redis 7+**
- Provider credentials for the features you want (all optional — unconfigured
  features stay inert, they don't crash)

## Quick start (local / evaluation)

```bash
git clone https://github.com/nometria/dayotter && cd dayotter
docker compose up -d            # Postgres + Redis
cp .env.example .env            # see Configuration below
pnpm install
pnpm db:push                    # create the schema
pnpm dev                        # web on http://localhost:3000 + worker
```

## Production

Use the Docker Compose stack in [`deploy/`](../deploy). It runs Postgres, Redis,
a one-shot migration, web, worker, and a reverse proxy.

```bash
cd deploy
cp .env.example .env            # fill in production values
./deploy.sh                     # build → run migrations → start
```

`deploy.sh` **always runs migrations before starting the app** — a plain
`docker compose up -d` reuses the completed migrate container and can boot new
code against an un-migrated DB. Full walkthrough (nginx + TLS options) in
[`deploy/README.md`](../deploy/README.md). To update: `git pull` then re-run
`./deploy.sh`.

## Configuration

Set these in `.env`. **Everything is optional** — DayOtter runs with just a
database, and each capability lights up when you add its credentials.

### Core (required)

```ini
DATABASE_URL=postgresql://user:pass@localhost:5432/dayotter
REDIS_URL=redis://localhost:6379
APP_URL=https://your-domain.com
BETTER_AUTH_SECRET=<32+ random bytes>     # openssl rand -base64 32
ENCRYPTION_KEY=<32 bytes>                  # encrypts OAuth tokens at rest
```

### Otter (AI) — bring your own key

```ini
ANTHROPIC_API_KEY=sk-ant-...              # that's it — every AI feature works
```

Because all AI flows through one layer (`lib/ai/llm.ts`), you can point it at a
different provider or a self-hosted model with a small change. See [`AI.md`](./AI.md).

### Calendars (OAuth)

```ini
GOOGLE_CLIENT_ID=...        GOOGLE_CLIENT_SECRET=...
MICROSOFT_CLIENT_ID=...     MICROSOFT_CLIENT_SECRET=...
# Apple/CalDAV needs no app — users add an app-specific password
```

Google sign-in also needs `NEXT_PUBLIC_*` build args baked at build time — the
Docker build handles this.

### Messaging & notifications

```ini
RESEND_API_KEY=...          # or SMTP_URL=smtp://...   (transactional email)
TWILIO_ACCOUNT_SID=...  TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+1...    TWILIO_WHATSAPP_FROM=whatsapp:+1...
```

**Inbound Otter (SMS/WhatsApp)** — point your Twilio number's inbound webhook at
`https://<APP_URL>/api/webhooks/twilio`. **Voice receptionist** — point the
number's *A Call Comes In* webhook at `.../api/webhooks/twilio/voice` and set
`VOICE_RECEPTIONIST_HANDLE=<the host handle>`. Both are signature-verified.

### Payments

```ini
STRIPE_SECRET_KEY=sk_...    STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...  # only if you run the paid cloud edition
```

Point Stripe's webhook at `.../api/webhooks/stripe`.

### Conferencing

```ini
ZOOM_CLIENT_ID=...  ZOOM_CLIENT_SECRET=...     # Google Meet / Teams need no extra config
```

## Editions

Leave `DAYOTTER_CLOUD` **unset** for the open-source edition: every Pro feature is
unlocked and there's no billing. Only set `DAYOTTER_CLOUD=1` if you're running the
hosted/commercial edition (which also needs the `ee/` commercial license — see
[`ENTERPRISE.md`](./ENTERPRISE.md)).

## Upgrading & migrations

Schema changes ship as SQL migrations in `packages/db/drizzle/`. `deploy.sh` (and
the compose `migrate` service) apply them. For local dev, `pnpm db:push` syncs the
schema directly.

## Backups & operations

- Back up Postgres (all app data) regularly. Redis holds jobs + ephemeral state
  and can be rebuilt.
- Rotate `BETTER_AUTH_SECRET` / `ENCRYPTION_KEY` carefully — changing
  `ENCRYPTION_KEY` invalidates stored OAuth tokens (users reconnect calendars).
- The worker writes a Redis heartbeat; monitor it for liveness.

## Troubleshooting

- **Google button missing** → `NEXT_PUBLIC_*` weren't baked at build; rebuild.
- **500s after deploy** → migrations didn't run; use `./deploy.sh`, never a bare
  `up -d`.
- **AI features absent** → `ANTHROPIC_API_KEY` unset (`aiEnabled` is false).
- **Webhooks rejected (403)** → wrong `TWILIO_AUTH_TOKEN` or `APP_URL` mismatch
  (signatures are validated against the public URL).

Questions? [Discussions](../../discussions) or hello@dayotter.com.
