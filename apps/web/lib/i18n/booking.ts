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
};

/** Translate a booking-surface key, interpolating `{name}` placeholders. */
export function t(locale: Locale, key: BookingKey, vars?: Record<string, string | number>): string {
  const s = (MESSAGES[locale] ?? MESSAGES.en)[key] ?? MESSAGES.en[key];
  return interpolate(s, vars);
}
