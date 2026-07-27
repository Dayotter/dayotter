"use client";

import { type ReactNode, createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_LOCALE, type Locale, SUPPORTED_LOCALES } from "./index";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);
const SetLocaleContext = createContext<(locale: Locale) => void>(() => {});

const STORAGE_KEY = "dayotter.locale";

/**
 * Provides the booking surface's locale to client components. It's SEEDED on the
 * SERVER from Accept-Language (so SSR and first paint match, with no flash of
 * English), but is also switchable at runtime via the language picker - the choice
 * is remembered in localStorage so a returning booker keeps their language.
 *
 * Reading the locale from context (instead of `navigator.language`) keeps SSR and
 * hydration in sync: the server has no `navigator`, so a client component that
 * derived its locale from `navigator` would render English on the server and the
 * user's language on the client, causing a hydration mismatch. Also reflects the
 * active locale onto `<html lang>` for screen readers (the root layout stays
 * static/English so the marketing site isn't forced dynamic; localized subtrees
 * fix `lang` here).
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const [current, setCurrent] = useState<Locale>(locale);

  // On mount, honor a previously chosen language over the server-resolved default.
  // Done in an effect (not initial state) so server and client first render agree.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) {
        setCurrent(saved as Locale);
      }
    } catch {
      /* localStorage unavailable (private mode) - keep the server locale */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = current;
  }, [current]);

  function choose(next: Locale) {
    setCurrent(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore persistence failures */
    }
  }

  return (
    <LocaleContext.Provider value={current}>
      <SetLocaleContext.Provider value={choose}>{children}</SetLocaleContext.Provider>
    </LocaleContext.Provider>
  );
}

export function useLocaleContext(): Locale {
  return useContext(LocaleContext);
}

/** Set the active booking-surface locale (persisted for return visits). */
export function useSetLocale(): (locale: Locale) => void {
  return useContext(SetLocaleContext);
}
