# Integration setup - IDs, keys & webhooks

Everything DayOtter connects to (calendars, CRM, video, billing, messaging, email)
is **optional and env-gated**: a provider is inert until you set its keys, so you
only wire up what you need. This guide is the one place that tells you, per
provider, **where to get the credentials, which redirect URI / webhook to register,
and which env var each value goes into.**

> **Two values everything depends on**
> - **`APP_URL`** - your deployment's public base URL (e.g. `https://dayotter.com`).
>   Every redirect URI and webhook below is `APP_URL` + a fixed path. It **must** be
>   the exact public HTTPS origin, with no trailing slash.
> - Set env vars in your deployment (the `.env` used by the web app **and** worker),
>   then **rebuild/redeploy** - some are read at build time.

After editing env, restart the container. Redirect URIs and webhook URLs must be
registered **exactly** (scheme, host, path) in each provider's console, or the
provider rejects the callback.

---

## Quick reference

| Provider | Env vars | Redirect URI (register in provider) | Webhook (register in provider) |
|---|---|---|---|
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | `APP_URL/api/calendars/connect/google/callback` | `APP_URL/api/webhooks/google` (auto-registered by the app; needs a public HTTPS `APP_URL` + a verified domain) |
| Microsoft / Outlook | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | `APP_URL/api/calendars/connect/microsoft/callback` | `APP_URL/api/webhooks/microsoft` (auto) |
| Apple iCloud | *(none - each user pastes an app-specific password)* | - (CalDAV, no OAuth) | - |
| Salesforce | `SALESFORCE_CLIENT_ID`, `SALESFORCE_CLIENT_SECRET` | `APP_URL/api/integrations/crm/salesforce/callback` | - |
| HubSpot | `HUBSPOT_CLIENT_ID`, `HUBSPOT_CLIENT_SECRET` | `APP_URL/api/integrations/crm/hubspot/callback` | - |
| Zoom | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | `APP_URL/api/integrations/zoom/callback` | - |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_WEBHOOK_SECRET` | - | `APP_URL/api/webhooks/stripe` |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SMS_FROM`, `TWILIO_WHATSAPP_FROM` | - | `APP_URL/api/webhooks/twilio` (set on the number/Messaging Service) |
| Resend (email) | `RESEND_API_KEY`, `EMAIL_FROM` | - | - |
| Mobile push | *(none - iOS works out of the box; Android needs your own Firebase project + `google-services.json`)* | - | - |

---

## Google Calendar (and Google sign-in)

1. [Google Cloud Console](https://console.cloud.google.com/) → create/select a project.
2. **APIs & Services → Enabled APIs** → enable **Google Calendar API**.
3. **OAuth consent screen** → configure (External), add the scopes below, and add
   your account as a test user (or publish the app).
4. **Credentials → Create credentials → OAuth client ID → Web application**.
   - **Authorized redirect URI:** `APP_URL/api/calendars/connect/google/callback`
   - (If you also use Google sign-in, add the auth callback your provider uses.)
5. Copy the client ID + secret into:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   NEXT_PUBLIC_GOOGLE_AUTH=1   # optional: show the "Sign in with Google" button
   ```
- **Scopes:** `calendar.events`, `calendar.readonly`, `openid`, `email`, `profile`.
- **Real-time sync (push):** the app registers a watch channel at
  `APP_URL/api/webhooks/google` automatically. Google only allows push to a
  **verified domain** over HTTPS - verify your domain under **Domain verification**
  in the console. If push isn't available it's non-fatal: DayOtter falls back to
  polling, so bookings still stay in sync.

## Microsoft 365 / Outlook

1. [Azure Portal](https://portal.azure.com/) → **Microsoft Entra ID → App registrations → New registration**.
2. **Redirect URI (Web):** `APP_URL/api/calendars/connect/microsoft/callback`.
3. **Certificates & secrets → New client secret** - copy the *value* (not the id).
4. **API permissions → Microsoft Graph → Delegated** → add `Calendars.ReadWrite`,
   `User.Read`, `offline_access`, `openid`, `email`, `profile`.
5. Env:
   ```
   MICROSOFT_CLIENT_ID=...       # the Application (client) ID
   MICROSOFT_CLIENT_SECRET=...   # the secret VALUE
   ```
- Push sync uses `APP_URL/api/webhooks/microsoft` (auto).

## Apple iCloud & CalDAV

No developer setup or env vars - these connect over **CalDAV** with a per-user
username + password, verified server-side on connect.

- **Apple iCloud:** generate an **app-specific password** at
  [appleid.apple.com](https://appleid.apple.com) (Sign-In & Security → App-Specific
  Passwords) and paste it in **Settings → Calendars → Apple iCloud / CalDAV**.
  Never the real Apple ID password.
- **Any other CalDAV server** (Fastmail, mailbox.org, Nextcloud, Radicale,
  self-hosted): pick the provider (or "Other CalDAV server" and enter the server
  URL, e.g. `https://cloud.example.com/remote.php/dav` for Nextcloud) in the same
  dialog. The URL must be a public HTTPS endpoint - it's DNS-resolved and rejected
  if it points at an internal/private address (SSRF-safe).

CalDAV calendars have no push webhooks, so DayOtter polls them on an interval
(CTag/ETag reconciled) rather than receiving live updates.

## Salesforce (CRM sync)

1. Salesforce **Setup → App Manager → New Connected App** (or **External Client Apps**).
2. Enable OAuth. **Callback URL:** `APP_URL/api/integrations/crm/salesforce/callback`.
3. **OAuth scopes:** `api` (Manage user data via APIs) and `refresh_token`
   (Perform requests any time - offline access).
4. Copy the **Consumer Key / Secret**:
   ```
   SALESFORCE_CLIENT_ID=...       # Consumer Key
   SALESFORCE_CLIENT_SECRET=...   # Consumer Secret
   ```
5. Users then connect under **Settings → CRM → Salesforce** (one-click OAuth - no
   keys to paste on their end).

## HubSpot (CRM sync)

1. [HubSpot developer account](https://developers.hubspot.com/) → **Create app**.
2. **Auth → Redirect URL:** `APP_URL/api/integrations/crm/hubspot/callback`.
3. **Scopes:** `crm.objects.contacts.read`, `crm.objects.contacts.write`.
4. Env:
   ```
   HUBSPOT_CLIENT_ID=...
   HUBSPOT_CLIENT_SECRET=...
   ```

## Zoom (video links)

1. [Zoom App Marketplace](https://marketplace.zoom.us/) → **Develop → Build App →
   OAuth** (user-managed).
2. **Redirect URL / OAuth allow list:** `APP_URL/api/integrations/zoom/callback`.
3. Add the scope to **create meetings** on the user's behalf.
4. Env:
   ```
   ZOOM_CLIENT_ID=...
   ZOOM_CLIENT_SECRET=...
   ```
Without these two the Zoom connect button is hidden. Google Meet needs no setup
(it comes with the Google Calendar connection); Microsoft Teams links come with the
Microsoft connection.

## Stripe (Pro billing - cloud edition only)

Billing only runs when `DAYOTTER_CLOUD=1`. Then:

1. [Stripe Dashboard](https://dashboard.stripe.com/) → **Developers → API keys** →
   copy the **Secret key** → `STRIPE_SECRET_KEY`.
2. **Products → add a Product** with a **recurring** price ($9/seat/mo). Open the
   price and copy its **API ID** - it starts with **`price_`**.
   ```
   STRIPE_PRICE_PRO=price_1Xxxx...   # MUST be the price_ ID, NOT a number/amount
   ```
3. **Developers → Webhooks → Add endpoint:**
   - **Endpoint URL:** `APP_URL/api/webhooks/stripe`
   - **Events:** `checkout.session.completed`, `customer.subscription.created`,
     `customer.subscription.updated`, `customer.subscription.deleted`.
   - Copy the endpoint's **Signing secret** → `STRIPE_WEBHOOK_SECRET`.
4. Dev tip: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

The webhook is what flips an org to **Pro** after payment (and handles seat
changes / cancellations). DayOtter also reconciles the plan on the checkout-success
redirect, so a one-off missed webhook won't leave you stuck - but configure the
webhook for ongoing changes.

### Stripe Connect - hosts get paid directly (bookings & packages)

So that a host's booking/package payments land in **their** bank rather than the
platform's, DayOtter uses **Stripe Connect (Express)**:

1. In the Stripe Dashboard, **enable Connect** (Connect → Get started) on the same
   platform account as `STRIPE_SECRET_KEY`.
2. Add the `account.updated` event to your webhook endpoint (`APP_URL/api/webhooks/stripe`),
   alongside the subscription events above - it's how DayOtter learns a host's
   account is ready.
3. (Optional) Take a platform cut per host transaction:
   ```
   STRIPE_PLATFORM_FEE_PERCENT=0   # e.g. 5 = keep 5% of each payment
   ```
- Hosts connect their bank under **Settings → Payouts** (one click → Stripe Express
  onboarding). Once approved, paid bookings and package sales route to their account
  as **destination charges** (minus your fee).
- Payouts are **manual**: the host withdraws to their bank from Settings → Payouts
  once their balance reaches **$100**. Refunds reverse the transfer + the fee.

## Twilio (SMS / WhatsApp reminders)

1. [Twilio Console](https://console.twilio.com/) → copy **Account SID** + **Auth Token**.
2. Get a phone number (SMS) and/or enable the WhatsApp sender.
   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_SMS_FROM=+1XXXXXXXXXX          # your SMS-capable number, E.164
   TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX
   ```
3. **Inbound replies** (so people can reply to reminders): set the number's (or
   Messaging Service's) incoming-message webhook to `APP_URL/api/webhooks/twilio`.
   On DayOtter Cloud this is DayOtter's managed Twilio; self-hosters bring their own.

## Mobile push (Android / FCM)

The mobile app registers an **Expo push token** and the server delivers through
Expo's push service (`packages/notifications/src/providers/push.ts`) - so there
are **no server env vars** for push, and **iOS needs no extra setup**.

Android is the exception: Expo hands Android notifications to **Firebase Cloud
Messaging**, so each deployment needs its own Firebase project. Without it the
app still builds and runs - only Android push stays off.

1. [Firebase Console](https://console.firebase.google.com/) → create a project
   (or pick one) → **Add app → Android**.
2. **Android package name:** `com.dayotter.app` (must match `android.package` in
   `apps/mobile/app.json`) → Register.
3. Download **`google-services.json`**. Put it at `apps/mobile/google-services.json`,
   or upload it as an EAS **file secret** and expose it as `GOOGLE_SERVICES_JSON`.
   `apps/mobile/app.config.js` picks up either automatically. It's gitignored -
   it's specific to your Firebase project.
4. **Project settings → Service accounts → Generate new private key** → download
   the JSON. ⚠️ **This is a secret** - treat it like a password. It does *not* go
   in the repo or in `.env`.
5. Upload that key to your Expo project so Expo can talk to FCM on your behalf:
   ```
   cd apps/mobile && eas credentials
   # → Android → production → Push Notifications: FCM V1 → upload the JSON from step 4
   ```
   (Or expo.dev → your project → Credentials → FCM V1.)
6. Build a real app (push never works in Expo Go - it needs a dev/production build):
   ```
   eas build --platform android --profile preview
   ```
7. Install it on a physical device, then **Settings → Notification channels →
   "Enable push on this device"**. The endpoint sends a real test push before it
   saves the channel, so a success there means delivery works end to end.

Troubleshooting: "Couldn't get a push token" almost always means Expo Go (use a
dev build) or missing FCM credentials (step 5). Delivery failures are logged with
`event: push_dispatch_failed` and the HTTP status from Expo.

## Resend (transactional email)

1. [Resend](https://resend.com/) → **API Keys** → create one → `RESEND_API_KEY`.
2. **Domains → Add domain**, then add the DNS records Resend gives you and wait
   for **Verified**.
3. Set the sender to an address **on that verified domain**:
   ```
   EMAIL_FROM="DayOtter <no-reply@yourdomain.com>"
   ```
   ⚠️ An unverified/placeholder domain (e.g. `example.com`) makes **every** email
   bounce with `550 domain is not verified` - confirmations and reminders silently
   fail. This is the #1 email setup mistake.

*Alternative to Resend:* any SMTP server via `SMTP_URL` (e.g.
`smtps://user:pass@smtp.host:465`). Resend also works over SMTP.

---

## Verifying it worked

- **Calendars:** Settings → Calendars → Connect → you should be redirected to the
  provider and back. If you get a redirect-URI error, the URI in the provider
  console doesn't match `APP_URL/api/...` exactly.
- **Stripe:** run a checkout; the billing page should flip to Pro. Check the webhook
  delivery attempts in the Stripe Dashboard.
- **Email:** create a test booking and watch the logs - `EMAIL_FROM is
  unset/example.com` or a `550` means the sender domain isn't verified.
- Every failure is logged with a structured `event` (e.g. `billing_checkout_failed`,
  `confirmation_email_failed`, `sync_watch_failed`) - grep your container logs.

See also: [`../.env.example`](../.env.example) (every variable in context) and
[`EDITIONS.md`](./EDITIONS.md) (self-hosted vs cloud).
