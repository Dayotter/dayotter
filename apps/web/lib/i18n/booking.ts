/**
 * Lightweight i18n for the public booking surface. The booker sees the whole
 * booking flow - time selection AND the attendee form - in their own language
 * and locale date formats.
 *
 * Message catalogs live in locales/<locale>/booking.json so translators can
 * edit plain JSON. Luxon handles date/number formatting given the locale.
 */

import { type Locale, interpolate } from "./index";
import de from "./locales/de/booking.json";
import en from "./locales/en/booking.json";
import es from "./locales/es/booking.json";
import fr from "./locales/fr/booking.json";
import it from "./locales/it/booking.json";
import nl from "./locales/nl/booking.json";
import pt from "./locales/pt/booking.json";

export {
  DEFAULT_LOCALE,
  type Locale,
  SUPPORTED_LOCALES,
  resolveLocale,
} from "./index";

export type BookingKey = keyof typeof en;

const MESSAGES: Record<Locale, Record<BookingKey, string>> = {
  en,
  es,
  fr,
  de,
  pt,
  it,
  nl,
};

/** Translate a booking-surface key, interpolating `{name}` placeholders. */
export function t(locale: Locale, key: BookingKey, vars?: Record<string, string | number>): string {
  // Falling back to the key itself matters more than it looks: without it a key
  // that is missing from every catalogue reaches interpolate() as undefined,
  // `.replace` throws, and the error boundary takes down the whole booking page.
  // A visible key is a bad string; a blank page is a lost booking.
  const s = (MESSAGES[locale] ?? MESSAGES.en)[key] ?? MESSAGES.en[key] ?? key;
  return interpolate(s, vars);
}
