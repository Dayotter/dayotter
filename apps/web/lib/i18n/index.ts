/**
 * Shared i18n primitives. Message catalogs live as JSON under `locales/` so
 * translators can contribute without editing TypeScript. Each namespace
 * (booking, otter, …) must be complete for every supported locale so the UI
 * is never half-translated.
 */

export const SUPPORTED_LOCALES = ["en", "es", "fr", "de", "pt"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Map a browser/Accept-Language value (e.g. "es-419,es;q=0.9") to a supported locale. */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  for (const part of input.split(",")) {
    const tag = part.trim().split(";")[0]?.toLowerCase() ?? "";
    const base = tag.split("-")[0] as Locale;
    if ((SUPPORTED_LOCALES as readonly string[]).includes(base)) return base;
  }
  return DEFAULT_LOCALE;
}

/** Interpolate `{name}` placeholders in a message string. */
export function interpolate(s: string, vars?: Record<string, string | number>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (_m, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
