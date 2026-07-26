/**
 * Per-host booking-page analytics pixels (GA4, GTM, Meta Pixel, Fathom,
 * Plausible).
 *
 * SECURITY: hosts configure *typed provider IDs*, never raw HTML/script
 * snippets. Each ID is validated against a strict pattern and then templated
 * into a fixed, known-safe script tag. This deliberately avoids the stored-XSS
 * hole that "paste your own <script>" designs open up. Keep this module pure
 * (no DB/React) so the validators are unit-tested in isolation.
 */

export interface BookingPixelConfig {
  /** GA4 measurement ID, e.g. G-XXXXXXX. */
  ga4?: string;
  /** Google Tag Manager container, e.g. GTM-XXXXXX. */
  gtm?: string;
  /** Meta (Facebook) Pixel ID - digits only. */
  metaPixel?: string;
  /** Fathom Analytics site ID (short alnum). */
  fathom?: string;
  /** Plausible domain (the site's domain, no protocol). */
  plausible?: string;
}

/** Strict per-provider ID patterns (anchored; no whitespace/markup possible). */
const PATTERNS: Record<keyof BookingPixelConfig, RegExp> = {
  ga4: /^G-[A-Z0-9]{4,20}$/i,
  gtm: /^GTM-[A-Z0-9]{4,20}$/i,
  metaPixel: /^\d{6,20}$/,
  fathom: /^[A-Z0-9]{5,16}$/i,
  plausible: /^[a-z0-9.-]{3,80}$/i,
};

const KEYS = Object.keys(PATTERNS) as (keyof BookingPixelConfig)[];

/** Is this a valid ID for the given provider? */
export function isValidPixelId(key: keyof BookingPixelConfig, value: string): boolean {
  return PATTERNS[key].test(value.trim());
}

/**
 * Keep only well-formed IDs from a raw/user-supplied config, trimmed. Anything
 * invalid or empty is dropped, so what reaches the page is always safe to
 * template. Returns `{}` when nothing is valid.
 */
export function sanitizePixelConfig(raw: unknown): BookingPixelConfig {
  if (!raw || typeof raw !== "object") return {};
  const input = raw as Record<string, unknown>;
  const out: BookingPixelConfig = {};
  for (const key of KEYS) {
    const v = input[key];
    if (typeof v === "string" && v.trim() && isValidPixelId(key, v)) {
      out[key] = v.trim();
    }
  }
  return out;
}

/** True when at least one provider is configured. */
export function hasAnyPixel(config: BookingPixelConfig): boolean {
  return KEYS.some((k) => Boolean(config[k]));
}
