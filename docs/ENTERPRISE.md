# Enterprise & the open-core boundary

DayOtter is **open-core**. This document is the honest, precise line between what
you get free forever and what's commercial — and why we drew it there.

**TL;DR:** the *whole product*, including every AI feature, is AGPLv3 and free to
self-host. A small `ee/` layer of *cloud-only infrastructure* is separately
licensed so the community can't resell our hosted service. That's the entire
difference.

## The two licenses

| | License | What it covers | Self-host? |
|---|---|---|---|
| **Core** | [AGPLv3](../LICENSE) | Everything outside `ee/` — scheduling, teams, **all of Otter's AI**, analytics, payments, packages, mobile | ✅ Free, forever |
| **Enterprise (`ee/`)** | [DayOtter EE License](../apps/web/lib/ee/LICENSE.md) | Cloud-only infrastructure (below) | ❌ Commercial only |

The `ee/` code is **source-available** (you can read it) but **not open source**:
you may not run, copy, modify, or resell it without a commercial agreement. It is
inert unless `DAYOTTER_CLOUD=1`.

## What's in `ee/` (and why it's not in the core)

These are **cloud-only infrastructure** — they're about *us operating a hosted
service*, not about product capability. A self-hoster doesn't need them because
they bring their own equivalents.

| `ee/` feature | What it is | Self-host equivalent |
|---|---|---|
| **Managed AI** | Otter running on *our* model key so you don't configure one | Set your own `ANTHROPIC_API_KEY` — same AI |
| **Hosted messaging** | SMS/WhatsApp on *our* Twilio with included credits | Set your own `TWILIO_*` |
| **SSO** | SAML / Google Workspace via our hosted control plane | (roadmap for self-host) |
| **White-label** | Remove branding + custom domain via our edge | `brandingHidden` gate exists; CNAME/TLS is hosted |

The pattern: **the code is open; the managed keys and credits are the commercial
part.** You can run Otter, messaging, and branding yourself — you just supply
your own provider accounts.

## Why this line (and not Cal.com's)

When [Cal.com went closed source](https://cal.com/blog/cal-diy-open-source-to-closed-source),
they *removed* the commercial features (Organizations, Teams, Routing, Workflows,
Instant Booking) from the open fork — so the open version is a stripped
demo. **We didn't.** Teams, routing, workflows, and all of Otter's AI are in the
open core. The only things behind a commercial license are the bits that only
make sense when *DayOtter* runs the servers.

This keeps the promise: **self-host the whole product, free.**

## How feature-gating works in code

- `lib/billing/edition.ts` — `isCloud = DAYOTTER_CLOUD === "1"` (deploy-time, so a
  self-hoster can't accidentally paywall themselves).
- `lib/billing/features.ts` — the tier catalog: `free` (never gated), `pro`
  (differentiators — **free on self-host**, $9/seat on cloud), `cloud`
  (`ee/`-only). Single policy: `hasFeature(feature, {isCloud, isPro})`.
- `lib/billing/require-feature.ts` — returns a 402 only on **cloud + not-Pro**; on
  self-host it never blocks.

So on self-host, `isPro` is effectively always true and `cloud` features are
simply absent. See [`EDITIONS.md`](./EDITIONS.md) for the full pricing/edition
breakdown.

## Commercial licensing

Want to run the `ee/` features in your own deployment, or need an enterprise
agreement (support, SLA, invoicing, a self-host SSO connector)? Email
**hello@dayotter.com**.

## Contributing to `ee/`

Most contributors never touch `ee/` — the product lives in the open core.
Contributions to `ee/` are accepted only under the EE license and need explicit
maintainer sign-off. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).
