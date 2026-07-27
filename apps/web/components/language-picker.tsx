"use client";

import { LOCALE_LABELS, type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";
import { useLocaleContext, useSetLocale } from "@/lib/i18n/locale-provider";
import { Globe } from "lucide-react";

/**
 * Lets a booker pick the booking-page language. The initial value is the
 * server-resolved locale (from Accept-Language); the choice is persisted by the
 * LocaleProvider. Native-rendered <select> so it stays light and accessible.
 */
export function LanguagePicker() {
  const locale = useLocaleContext();
  const setLocale = useSetLocale();
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
      <Globe size={14} aria-hidden />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="cursor-pointer rounded-md border border-[var(--color-border)] bg-transparent py-1 pr-6 pl-2 text-xs text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
