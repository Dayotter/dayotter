"use client";

import { useMemo } from "react";
import { type Locale, resolveLocale } from "./index";

/** Locale from the browser language, resolved once on mount. */
export function useAppLocale(): Locale {
  return useMemo(
    () => resolveLocale(typeof navigator !== "undefined" ? navigator.language : null),
    [],
  );
}

/** The booker's locale (alias of useAppLocale for the public booking surface). */
export function useBookingLocale(): Locale {
  return useAppLocale();
}
