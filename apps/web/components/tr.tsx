"use client";

import { type BookingKey, t } from "@/lib/i18n/booking";
import { useBookingLocale } from "@/lib/i18n/use-locale";

/**
 * Renders one booking-surface string in the *active* locale (context-driven), so
 * it reacts live when the booker switches language - unlike a server-rendered
 * `t(locale, …)` call, which is fixed at the request's Accept-Language.
 */
export function Tr({
  k,
  vars,
}: {
  k: BookingKey;
  vars?: Record<string, string | number>;
}) {
  return <>{t(useBookingLocale(), k, vars)}</>;
}
