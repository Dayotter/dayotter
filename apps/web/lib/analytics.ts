/**
 * Client analytics facade over Mixpanel + Google Analytics (GA4).
 *
 * Both are OPTIONAL and independent: nothing loads or tracks unless the matching
 * public env var is set, so local dev and self-hosters run analytics-free by
 * default. Import `track`/`identify` anywhere in a client component and call them
 * on real user actions - we deliberately track meaningful events (button clicks,
 * flow completions), not just page views.
 */

export const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
export const analyticsEnabled = Boolean(MIXPANEL_TOKEN || GA_ID);

type Props = Record<string, unknown>;

interface MixpanelLike {
  track: (event: string, props?: Props) => void;
  identify: (id: string) => void;
  reset: () => void;
  people?: { set: (traits: Props) => void };
}

declare global {
  interface Window {
    mixpanel?: MixpanelLike;
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Record a named product event (e.g. "Booking Confirmed") with properties. */
export function track(event: string, props?: Props): void {
  if (typeof window === "undefined") return;
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
}

/** Associate subsequent events with a signed-in user. */
export function identify(userId: string, traits?: Props): void {
  if (typeof window === "undefined") return;
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
}

/** Clear identity on sign-out. */
export function resetAnalytics(): void {
  if (typeof window === "undefined") return;
  try {
    window.mixpanel?.reset();
  } catch {
    /* noop */
  }
}

/** Manual page-view (route changes) - auto page_view is disabled so this is the
 * single source of truth for both providers. */
export function pageview(url: string): void {
  if (typeof window === "undefined") return;
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
}
