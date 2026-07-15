---
name: analytics
description: DayOtter's optional client analytics module (Mixpanel + Google Analytics 4 + PostHog) in apps/web/lib/analytics.ts. Two independent switches — per-provider env config (deployer) and a per-browser opt-out (end user). Load this when adding tracking, wiring a new provider, or changing consent behavior.
---

# Analytics

Optional, provider-agnostic client analytics. **Two independent switches**, both
must allow before anything is captured:

1. **Deployer config** — each provider loads only when its `NEXT_PUBLIC_*` env var
   is set. No env vars → zero analytics code loads (self-host/local default).
   - `NEXT_PUBLIC_MIXPANEL_TOKEN`, `NEXT_PUBLIC_GA_ID`,
     `NEXT_PUBLIC_POSTHOG_KEY` (+ `NEXT_PUBLIC_POSTHOG_HOST`).
   - `analyticsConfigured` / `configuredProviders` reflect what's wired.
2. **End-user consent** — even when configured, the visitor can opt out in
   Settings → Preferences (`components/analytics-preferences.tsx`). Consent is a
   per-browser `localStorage` flag (opt-out; on by default when configured).

## The single gate

Every emit path (`track`, `identify`, `pageview`) short-circuits on
`analyticsAllowed()` (configured AND not opted out). `setAnalyticsEnabled(false)`
opts out immediately: calls `posthog.opt_out_capturing()` and `resetAnalytics()`.
`resetAnalytics()` also runs on sign-out (app-nav / mobile-nav).

## How to add tracking

```ts
import { track, identify } from "@/lib/analytics"; // client components only
track("Booking Confirmed", { eventType, durationMin });
```

Track **meaningful product events** (flow completions, key clicks) — not every
page view (route page-views are already reported by `components/analytics.tsx`).
Analytics must **never break the app**: all provider calls are wrapped in try/catch.

## Loading

`components/analytics.tsx` (mounted in the root layout) loads the SDKs only when
allowed — Mixpanel via dynamic `import`, GA4 + PostHog via their official inline
snippets (`next/script`, `afterInteractive`). Provider auto page-view is disabled;
`pageview()` is the single source of truth across all three.

To add a fourth provider: add its env + `*Like` interface + emit calls in
`lib/analytics.ts`, and a loader branch in `components/analytics.tsx`. Keep it
gated by `analyticsAllowed()`.
