"use client";

import type { Locale } from "./index";
import { useLocaleContext } from "./locale-provider";

/**
 * The request locale, provided by `<LocaleProvider>` (resolved on the server from
 * Accept-Language). Reading it from context keeps SSR and client renders in sync -
 * no hydration mismatch, no flash of English. Falls back to the default locale
 * outside a provider.
 */
export function useAppLocale(): Locale {
  return useLocaleContext();
}

/** The booker's locale on the public booking surface (alias of useAppLocale). */
export function useBookingLocale(): Locale {
  return useAppLocale();
}
