/**
 * Client analytics facade over Mixpanel, Google Analytics (GA4), and PostHog.
 *
 * Two independent switches keep this optional:
 *
 * 1. **Deployer config** - each provider only loads when its `NEXT_PUBLIC_*` env
 *    var is set. No env vars => zero analytics code loads (self-hosters and local
 *    dev run analytics-free by default).
 * 2. **End-user consent** - even when a provider is configured, the visitor can
 *    opt out (Settings -> Preferences). Consent lives in `localStorage`, so it's
 *    per-browser and needs no account. `track`/`identify`/`pageview` all no-op
 *    while opted out.
 *
 * Import `track`/`identify` anywhere in a client component and call them on real
 * user actions - we deliberately track meaningful events (button clicks, flow
 * completions), not just page views.
 */

export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

/** True when the deploy has wired up at least one analytics provider. */
export const analyticsConfigured = Boolean(MIXPANEL_TOKEN || GA_ID || POSTHOG_KEY);

/** The providers this deploy has enabled - drives the loader and the settings copy. */
export const configuredProviders: string[] = [
  MIXPANEL_TOKEN && "Mixpanel",
  GA_ID && "Google Analytics",
  POSTHOG_KEY && "PostHog",
].filter((v): v is string => Boolean(v));

type Props = Record<string, unknown>;

interface MixpanelLike {
  track: (event: string, props?: Props) => void;
  identify: (id: string) => void;
  reset: () => void;
  people?: { set: (traits: Props) => void };
}

interface PosthogLike {
  capture: (event: string, props?: Props) => void;
  identify: (id: string, traits?: Props) => void;
  reset: () => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
}

declare global {
  interface Window {
    mixpanel?: MixpanelLike;
    posthog?: PosthogLike;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// --- Consent -------------------------------------------------------------

const CONSENT_KEY = "dayotter.analytics.optOut";

/**
 * Whether analytics may run right now: a provider is configured AND the user
 * hasn't opted out in this browser. Analytics is on by default when configured;
 * the user chooses to disable it. Every emit path goes through this gate.
 */
export function analyticsAllowed(): boolean {
  if (typeof window === "undefined" || !analyticsConfigured) return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) !== "1";
  } catch {
    return true; // storage blocked -> don't punish the default
  }
}

/** Read the current opt-out flag (true = the user has disabled analytics). */
export function analyticsOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CONSENT_KEY) === "1";
  } catch {
    return false;
  }
}

/** Toggle analytics for this browser. Opting out immediately stops all capture. */
export function setAnalyticsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CONSENT_KEY, enabled ? "0" : "1");
  } catch {
    /* storage blocked - nothing to persist */
  }
  if (enabled) {
    window.posthog?.opt_in_capturing();
  } else {
    // Stop the providers that support runtime opt-out and drop identity.
    window.posthog?.opt_out_capturing();
    resetAnalytics();
  }
}

// --- Emit ----------------------------------------------------------------

/** Record a named product event (e.g. "Booking Confirmed") with properties. */
export function track(event: string, props?: Props): void {
  if (!analyticsAllowed()) return;
  try {
    window.mixpanel?.track(event, props);
  } catch {
    /* analytics must never break the app */
  }
  try {
    window.gtag?.("event", event, props ?? {});
  } catch {
    /* noop */
  }
  try {
    window.posthog?.capture(event, props);
  } catch {
    /* noop */
  }
}

/** Associate subsequent events with a signed-in user. */
export function identify(userId: string, traits?: Props): void {
  if (!analyticsAllowed()) return;
  try {
    window.mixpanel?.identify(userId);
    if (traits) window.mixpanel?.people?.set(traits);
  } catch {
    /* noop */
  }
  try {
    window.gtag?.("set", { user_id: userId });
  } catch {
    /* noop */
  }
  try {
    window.posthog?.identify(userId, traits);
  } catch {
    /* noop */
  }
}

/** Clear identity on sign-out. Runs regardless of consent (it only clears). */
export function resetAnalytics(): void {
  if (typeof window === "undefined") return;
  try {
    window.mixpanel?.reset();
  } catch {
    /* noop */
  }
  try {
    window.posthog?.reset();
  } catch {
    /* noop */
  }
}

/** Manual page-view (route changes) - provider auto page-view is disabled so
 * this is the single source of truth across all three. */
export function pageview(url: string): void {
  if (!analyticsAllowed()) return;
  try {
    window.mixpanel?.track("Page Viewed", { url });
  } catch {
    /* noop */
  }
  try {
    if (GA_ID) window.gtag?.("event", "page_view", { page_path: url });
  } catch {
    /* noop */
  }
  try {
    window.posthog?.capture("$pageview", { $current_url: url });
  } catch {
    /* noop */
  }
}
