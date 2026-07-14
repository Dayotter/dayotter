# Deploying dayotter

Self-host the whole platform - web app, background worker, Postgres, Redis, and
automatic HTTPS - on one server. Three ways in, easiest first.

> Replace `OWNER/dayotter` below with your GitHub repo (or fork) before sharing
> these links.

---

## Option A - One-click on AWS (recommended)

Launches a single EC2 instance that boots the full stack automatically.

[![Launch Stack](https://s3.amazonaws.com/cloudformation-examples/cloudformation-launch-stack.png)](https://console.aws.amazon.com/cloudformation/home#/stacks/quickcreate?templateURL=https://raw.githubusercontent.com/OWNER/dayotter/main/deploy/aws/cloudformation.yaml&stackName=dayotter)

1. Click **Launch Stack** (defaults are fine).
2. Optionally set **Domain** to a hostname you control for automatic HTTPS -
   otherwise it starts on plain HTTP at the instance's public IP.
3. Create the stack. First boot builds the images and takes ~5–10 minutes.
4. Open the **URL** in the stack's *Outputs* tab.

**Adding a domain / HTTPS later:** point the domain's `A` record at the
**PublicIP** output, then re-run the installer with the domain:

```bash
aws ssm start-session --target <instance-id>      # keyless shell (or SSH)
cd /opt/dayotter && sudo DAYOTTER_DOMAIN=cal.example.com bash deploy/install.sh
```

Cost: runs comfortably on a `t3.small` (~US$15/mo) plus the disk. The template
adds swap so the build survives on small instances.

---

## Option B - One command on any Ubuntu/Debian server

On a fresh box (a VPS, a home server, anything with Docker-able Linux):

```bash
curl -fsSL https://raw.githubusercontent.com/OWNER/dayotter/main/deploy/install.sh \
  | sudo DAYOTTER_DOMAIN=cal.example.com bash
```

Omit `DAYOTTER_DOMAIN` to start on HTTP at the server's public IP. The installer
installs Docker, generates secrets once, and starts everything.

---

## Option C - Manual (you already have a checkout)

```bash
cp deploy/.env.prod.example deploy/.env
# edit deploy/.env - set APP_URL, DAYOTTER_SITE_ADDRESS, POSTGRES_PASSWORD,
# AUTH_SECRET, BETTER_AUTH_SECRET, ENCRYPTION_KEY (generators are in the file)

cd deploy
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

---

## Option D - Behind your own nginx (Let's Encrypt)

For a server that already runs **host nginx** fronting other sites (e.g. an EC2
box). Run everything except the bundled Caddy, publish the app on
`127.0.0.1:3000`, and let your nginx terminate TLS with certbot.

> The bundled Postgres publishes **no host port** (it's private to the compose
> network), so it never conflicts with anything else on the host's `5432`
> - e.g. a local Supabase. Nothing to change.

**1. Point DNS at the box.** With Namecheap: *Domain List -> Manage -> Advanced
DNS -> Host Records*, add `A @ -> <server IP>` and `A www -> <server IP>` (use an
Elastic IP on EC2 so it's stable). Confirm with `dig +short dayotter.com`.

**2. Configure `deploy/.env`** as in Option C, with:

```ini
APP_URL=https://dayotter.com
BETTER_AUTH_URL=https://dayotter.com
# DAYOTTER_SITE_ADDRESS is unused here (Caddy is disabled)
```

**3. Bring up the stack without Caddy** (database + migrations + app):

```bash
cd deploy
docker compose -f docker-compose.prod.yml -f docker-compose.nginx.yml --env-file .env   up -d --build            # starts postgres, redis, migrate, web, worker (not caddy)

curl -I http://127.0.0.1:3000     # sanity check the app is up locally
```

**4. Add the nginx site** (alongside your existing ones):

```bash
sudo cp nginx/dayotter.com.conf /etc/nginx/sites-available/dayotter.com
sudo ln -s /etc/nginx/sites-available/dayotter.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**5. Issue the certificate** (adds the `:443` block + HTTP->HTTPS redirect + auto-renew):

```bash
sudo apt-get install -y certbot python3-certbot-nginx   # if not already present
sudo certbot --nginx -d dayotter.com -d www.dayotter.com
sudo certbot renew --dry-run
```

Open **https://dayotter.com**.

### Redeploying / updating

Do **not** just re-run `up -d --build`: `docker compose up -d` reuses the already
completed one-shot `migrate` container instead of re-running it, so new app code
can boot against an un-migrated database (missing columns → 500s everywhere).

Use the script, which always builds, then runs a **fresh** migration one-shot,
then (re)starts the stack - in that order:

```bash
git -C .. pull
./deploy.sh          # build → run --rm migrate → up -d
```

Or run the equivalent by hand from `deploy/` (add `-f docker-compose.nginx.yml`
when using the host-nginx overlay):

```bash
docker compose -f docker-compose.prod.yml --env-file .env build web worker
docker compose -f docker-compose.prod.yml --env-file .env run --rm migrate
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

> Prefer to reuse an existing managed/Supabase Postgres instead of the bundled
> one? Set `DATABASE_URL=postgresql://user:pass@host:5432/dayotter` in
> `deploy/.env` (migrations still run automatically against it) and omit the
> `postgres` service from the `up` command.

---

## What runs

| Service    | Role                                                            |
|------------|-----------------------------------------------------------------|
| `caddy`    | Reverse proxy + automatic HTTPS (Let's Encrypt) on 80/443       |
| `web`      | Next.js app (booking pages, dashboard, API)                     |
| `worker`   | BullMQ worker - reminders, calendar sync, webhooks              |
| `migrate`  | One-shot: applies DB migrations on boot, then exits             |
| `postgres` | Database (persisted in the `dayotter_pgdata` volume)             |
| `redis`    | Queues + cache (persisted in `dayotter_redisdata`)               |

Only Caddy is exposed to the internet; everything else talks over the private
Compose network.

## Day-two operations

```bash
cd deploy
docker compose -f docker-compose.prod.yml logs -f            # tail logs
docker compose -f docker-compose.prod.yml ps                 # status
git -C .. pull && bash install.sh                            # update to latest
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U dayotter dayotter > backup-$(date +%F).sql        # back up the DB
```

## Turning on integrations

Everything except the calendar core is optional and off until you add its keys
to `deploy/.env`, then `docker compose -f docker-compose.prod.yml up -d`:

- **Google / Microsoft calendar + Google sign-in** - OAuth client id/secret
  (register `${APP_URL}/api/auth/callback/google` as a redirect URI).
- **Email** (confirmations, reminders, password resets) - `SMTP_URL`.
- **AI scheduling** - `ANTHROPIC_API_KEY`.
- **Zoom, Stripe payments, Twilio SMS/WhatsApp, Turnstile captcha** - see the
  comments in `.env.prod.example`.

> `NEXT_PUBLIC_*` values are baked into the web build - after changing one,
> rebuild with `... up -d --build`.

## Notes

- The bundled Postgres lives on the instance's disk. For anything serious, take
  regular `pg_dump` backups (or point `DATABASE_URL` at a managed database and
  drop the `postgres` service).
- Deleting the CloudFormation stack deletes the instance **and its database**.
