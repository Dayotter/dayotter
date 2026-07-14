# Turning on integrations

Every integration is **off until you add its keys** to `deploy/.env`, then apply.
All URLs below assume your `APP_URL` is `https://dayotter.com` - swap in your own
domain.

## How to apply a change

```bash
cd ~/dayotter/deploy
FILES="-f docker-compose.prod.yml -f docker-compose.nginx.yml --env-file .env"

# server-only keys - just recreate the containers:
docker compose $FILES up -d

# any key starting with NEXT_PUBLIC_ is BAKED into the web build - rebuild:
docker compose $FILES up -d --build web
```

> Rule of thumb: **`NEXT_PUBLIC_*` → rebuild `web`**; everything else → plain `up -d`.
> (`NEXT_PUBLIC_*` values are inlined at build time; the Dockerfile receives them
> as build args, so a rebuild is required for them to take effect.)

---

## Google - Sign-in **and** Calendar (one OAuth client covers both)

[Google Cloud Console](https://console.cloud.google.com) → create/select a project.

1. **APIs & Services → Library →** enable **Google Calendar API**.
2. **OAuth consent screen** → External; app name + support email; add the calendar
   and email/profile scopes; add yourself as a Test user (or Publish).
3. **Credentials → Create credentials → OAuth client ID → Web application.** Add
   **both** authorized redirect URIs:
   - `https://dayotter.com/api/auth/callback/google` - sign-in
   - `https://dayotter.com/api/calendars/connect/google/callback` - calendar connect

```ini
GOOGLE_CLIENT_ID=<client id>
GOOGLE_CLIENT_SECRET=<client secret>
NEXT_PUBLIC_GOOGLE_AUTH=1      # shows the "Continue with Google" button
```
Apply: **`up -d --build web`** (because of `NEXT_PUBLIC_GOOGLE_AUTH`).

## Email / SMTP (confirmations, reminders, password resets)

Any SMTP provider works; **verify your sending domain first**. Using Resend:

```ini
SMTP_URL=smtps://resend:re_YOUR_API_KEY@smtp.resend.com:465
EMAIL_FROM="DayOtter <no-reply@dayotter.com>"
```
Username is `resend`, password is your Resend API key. Port 465 = implicit TLS
(use `smtp://…:587` for STARTTLS). Apply: `up -d`.

## AI assistant (Anthropic)

[console.anthropic.com](https://console.anthropic.com) → API Keys.
```ini
ANTHROPIC_API_KEY=sk-ant-...
```
Apply: `up -d`.

## Microsoft / Outlook Calendar

[Azure Portal](https://portal.azure.com) → **App registrations → New registration**.
Redirect URI (Web): `https://dayotter.com/api/calendars/connect/microsoft/callback`.
Delegated API permissions: `offline_access, openid, email, profile, User.Read,
Calendars.ReadWrite`. Create a client secret.
```ini
MICROSOFT_CLIENT_ID=<application (client) id>
MICROSOFT_CLIENT_SECRET=<client secret value>
```
Apply: `up -d`.

## Zoom (auto meeting links)

[Zoom Marketplace](https://marketplace.zoom.us) → **Build App → OAuth**. Redirect
URL: `https://dayotter.com/api/integrations/zoom/callback`; scope `meeting:write`.
```ini
ZOOM_CLIENT_ID=<client id>
ZOOM_CLIENT_SECRET=<client secret>
```
Apply: `up -d`.

## SMS / WhatsApp + phone sign-in (Twilio)

[Twilio Console](https://console.twilio.com) → Account SID + Auth Token; buy/verify
a sending number.
```ini
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_SMS_FROM=+1XXXXXXXXXX
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # optional
NEXT_PUBLIC_PHONE_AUTH=1     # shows the "Continue with phone" (OTP) button
```
Apply: **`up -d --build web`** (because of `NEXT_PUBLIC_PHONE_AUTH`).

## Browser push reminders (Web Push / VAPID)

Generate a keypair once: `npx web-push generate-vapid-keys`.
```ini
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_SUBJECT=mailto:you@dayotter.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public>   # same value as VAPID_PUBLIC_KEY
```
Apply: **`up -d --build web`**.

## Payments (Stripe)

[Stripe Dashboard](https://dashboard.stripe.com/apikeys). Add a webhook endpoint at
`https://dayotter.com/api/webhooks/stripe` and copy its signing secret.
```ini
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```
Apply: **`up -d --build web`**.

## Captcha on the booking form (Cloudflare Turnstile)

[Cloudflare → Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) → add
site `dayotter.com`.
```ini
TURNSTILE_SECRET=<secret key>
NEXT_PUBLIC_TURNSTILE_SITE_KEY=<site key>
```
Apply: **`up -d --build web`**.

---

## Quick verify

- **Google:** the "Continue with Google" button appears on `/sign-in`; connecting a
  calendar under Settings → Calendars completes without an OAuth error.
- **Email:** trigger a password reset and confirm it arrives (check the provider's
  dashboard).
- Logs: `docker compose -f docker-compose.prod.yml -f docker-compose.nginx.yml logs -f web worker`.

The redirect URIs must match `APP_URL` **exactly** (https, no trailing slash).
