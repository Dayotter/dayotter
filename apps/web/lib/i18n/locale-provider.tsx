"use client";

import { type ReactNode, createContext, useContext, useEffect } from "react";
import { DEFAULT_LOCALE, type Locale } from "./index";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/**
 * Provides the request's locale - resolved on the SERVER from Accept-Language -
 * to client components. Reading it from context (instead of `navigator.language`)
 * keeps SSR and hydration in sync: the server has no `navigator`, so a client
 * component that derived its locale from `navigator` would render English on the
 * server and the user's language on the client, causing a hydration mismatch and
 * a flash of English. Also reflects the locale onto `<html lang>` on the client
 * (the root layout stays static/English so the marketing site isn't forced
 * dynamic; localized subtrees fix `lang` here for screen readers).
 */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): Locale {
  return useContext(LocaleContext);
}
