---
name: editions-and-billing
description: How DayOtter's self-hosted vs cloud editions work, gated by the DAYOTTER_CLOUD deploy flag and lib/billing/edition.ts. Load this when touching billing, CRM, messaging, managed AI, the ee/ layer, or any feature that should behave differently on the hosted product — or when a "self-hosted / not configured" message shows up where cloud behavior was expected.
---

# Editions & billing

DayOtter ships in two editions chosen **at deploy time** by one env var.

```ts
// apps/web/lib/billing/edition.ts
export const isCloud = process.env.DAYOTTER_CLOUD === "1";
export const isSelfHosted = !isCloud;
```

- **Self-hosted (flag unset — the default):** every Pro feature is unlocked, no
  billing. The billing settings page shows "Self-hosted — everything unlocked."
  Integrations (CRM, messaging, AI keys) are configured via environment variables.
- **Cloud (`DAYOTTER_CLOUD=1`):** a free tier + a $9/seat/mo Pro plan gate the
  differentiator features, and the commercially-licensed `apps/web/lib/ee/` layer
  (managed AI, hosted messaging, SSO…) becomes available.

**A self-hoster can never accidentally paywall themselves** — the flag defaults
off. So never move a core feature behind `isCloud`; only cloud-*infrastructure*
lives in `ee/` (see `apps/web/lib/ee/LICENSE.md`).

## Debugging "wrong edition" reports

If a hosted deployment shows the self-hosted billing card, or CRM shows
"Coming soon / not configured," the root cause is almost always **`DAYOTTER_CLOUD`
is not set in that environment** — this is deploy config, not a code bug. The
gate itself reads `process.env` at runtime in server components and is correct.

- Billing: `apps/web/app/(app)/settings/billing/page.tsx` branches on `isCloud`.
- CRM messaging is **edition-aware** (`settings/crm/page.tsx`): self-hosters get
  the actionable env instruction (`SALESFORCE_CLIENT_ID` / `HUBSPOT_CLIENT_ID`…);
  cloud users see "Coming soon" rather than a meaningless "set an env var."
- CRM providers only appear as connectable when their client id/secret env is
  set (`crmEnabledProviders()` in `packages/integrations`). In cloud, the platform
  sets those once; end users then just click Connect (OAuth, no keys to paste).

## When adding an edition-gated surface

1. Import `isCloud` from `@/lib/billing/edition`.
2. Give self-hosters an **actionable** path (which env var to set), and cloud
   users the plan/upgrade path — don't show env instructions to cloud users.
3. Verify both editions locally: launch config `web` (self-hosted) and `web-cloud`
   (sets `DAYOTTER_CLOUD=1`).

Docs: `docs/EDITIONS.md`, `docs/ENTERPRISE.md`.
