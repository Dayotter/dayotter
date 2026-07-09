"use client";

import { useMemo } from "react";
import { type Locale, resolveLocale } from "./booking";

/** The booker's locale, resolved from their browser once on mount. */
export function useBookingLocale(): Locale {
  return useMemo(
    () => resolveLocale(typeof navigator !== "undefined" ? navigator.language : null),
    [],
  );
}
