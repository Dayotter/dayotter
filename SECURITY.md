# Security Policy

DayOtter handles calendars, tokens, and personal data - we take security
seriously, and we believe being open makes the product *more* secure, not less.
Every line is auditable, and fixes ship in the open.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via one of:

- **GitHub** → *Security* tab → *Report a vulnerability* (private advisory), or
- **Email** `security@dayotter.com` (PGP available on request).

Please include: a description, steps to reproduce (or a PoC), affected
version/commit, and impact. We'll acknowledge within **3 business days**, keep
you updated, and credit you in the advisory unless you prefer to stay anonymous.

Please give us a reasonable window to fix and release before public disclosure
(we aim for 90 days or sooner for critical issues).

## Scope

In scope: the code in this repository (web, worker, mobile, packages) and the
hosted product at dayotter.com. Out of scope: third-party services we integrate
with (Google, Microsoft, Stripe, Twilio, Anthropic) - report those to the
respective vendor.

## Handling secrets safely (self-hosters)

- OAuth tokens, notification secrets, and webhook signing keys are **encrypted at
  rest** (AES-256-GCM); API keys are stored **hashed**.
- Set a strong `ENCRYPTION_KEY` / `BETTER_AUTH_SECRET` and never commit `.env`.
- Inbound webhooks (Twilio SMS/voice, Stripe, calendar providers) are
  **signature-verified and fail closed**.
- Keep your deployment updated - security fixes land on `main` and are noted in
  the changelog.

## Our stance on "AI and security"

Some vendors have used AI-assisted vulnerability discovery as a reason to *close*
their source. We take the opposite view: transparency plus responsible
disclosure is the stronger model. Automated auditing helps defenders too - we'd
rather fix issues in the open than hide the code.
