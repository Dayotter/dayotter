/**
 * i18n for Otter / AI chrome (chat, voice, proactive nudges, text panel, and
 * the public booking assistant). Catalogs live in locales/<locale>/otter.json.
 */

import { type Locale, interpolate } from "./index";
import de from "./locales/de/otter.json";
import en from "./locales/en/otter.json";
import es from "./locales/es/otter.json";
import fr from "./locales/fr/otter.json";
import pt from "./locales/pt/otter.json";

export type OtterKey = keyof typeof en;

const MESSAGES: Record<Locale, Record<OtterKey, string>> = {
  en,
  es,
  fr,
  de,
  pt,
};

/** Translate an Otter/AI UI key, interpolating `{name}` placeholders. */
export function tOtter(
  locale: Locale,
  key: OtterKey,
  vars?: Record<string, string | number>,
): string {
  const s = (MESSAGES[locale] ?? MESSAGES.en)[key] ?? MESSAGES.en[key];
  return interpolate(s, vars);
}
