# dayotter editions & pricing

dayotter is **open-core**, following the same model as Cal.com:

## Self-hosted (open source)

Run dayotter on your own infrastructure and **every scheduling feature is free,
forever** — including the differentiators (AI scheduling, automations, analytics,
multi-channel reminders, adaptive/travel/deep-work, accept-payments, developer
platform). There is no license key and no billing. Just don't set `CALSYNC_CLOUD`.

The only things a self-hoster doesn't get are the **cloud-only** features (below),
which live in `apps/web/lib/ee/` under a separate commercial license and are
inert unless `CALSYNC_CLOUD=1`.

## dayotter Cloud (hosted)

The hosted product at dayotter.com has:

- **Free tier** — all core scheduling: unlimited event types, availability,
  Google/Microsoft/Apple calendar sync, booking management, email reminders,
  teams.
- **Pro — $9/seat/month** — unlocks the differentiator bundle (the same features
  self-hosters get for free): AI + Intelligence, automations, analytics,
  Slack/WhatsApp/SMS reminders, adaptive availability, travel-aware, deep-work
  defense, accept-payments, and the developer platform.
- **Cloud-only** (commercial `ee/`, Pro): **Managed AI** (no API key to
  configure), **SSO** (SAML / Google Workspace), **White-label** (remove branding
  + custom booking domain), and **Hosted messaging** (SMS/WhatsApp on dayotter's
  Twilio with included credits).

## How it works in code

- `lib/billing/edition.ts` — `isCloud` (`CALSYNC_CLOUD=1` at deploy time).
- `lib/billing/features.ts` — the feature → tier catalog (`free` / `pro` /
  `cloud`) and the single `hasFeature()` policy.
- `lib/billing/entitlements.ts` — resolves a user's org plan + edition into a
  per-feature allow map (returned by `/api/me`).
- `lib/billing/require-feature.ts` — `requireFeature()` gates API routes with a
  402 on cloud + free. On self-host it never blocks.
- Billing runs on the **organization** (per-seat) via Stripe subscriptions; the
  webhook keeps `organizations.plan` in sync.

### Cloud env vars

```
CALSYNC_CLOUD=1                       # turn on the hosted edition
STRIPE_PRICE_PRO=price_...            # the $9/seat recurring price
CALSYNC_MANAGED_ANTHROPIC_KEY=...     # Managed AI (cloud-only)
CALSYNC_MANAGED_TWILIO_SID=...        # Hosted messaging (cloud-only)
CALSYNC_MANAGED_TWILIO_TOKEN=...
CALSYNC_MANAGED_TWILIO_SMS_FROM=...
CALSYNC_MANAGED_TWILIO_WA_FROM=...
```
