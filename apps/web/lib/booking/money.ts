/** Currency + money helpers - client-safe (no Stripe SDK), shared by the form,
 *  booking pages, and the server payment layer. */

export const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "inr"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  usd: "$",
  eur: "€",
  gbp: "£",
  cad: "C$",
  aud: "A$",
  inr: "₹",
};

/**
 * Stripe "zero-decimal" currencies: the amount is already the whole unit, with
 * no minor unit to divide by (¥100 is 100, not 10000). Dividing these by 100
 * would under-report balances and payouts 100x. See
 * https://stripe.com/docs/currencies#zero-decimal
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/** Smallest units per major unit: 1 for zero-decimal (JPY), 100 otherwise. */
export function minorPerUnit(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toLowerCase()) ? 1 : 100;
}

/** Format minor units + currency for display, e.g. (2500, "usd") → "$25.00",
 *  (10000, "jpy") → "¥10000". Honors zero-decimal currencies. */
export function formatMoney(minor: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency as Currency] ?? "";
  const per = minorPerUnit(currency);
  const value = (minor / per).toFixed(per === 1 ? 0 : 2);
  return sym ? `${sym}${value}` : `${value} ${currency.toUpperCase()}`;
}

/**
 * Per-currency minimum withdrawable balance, in that currency's SMALLEST unit.
 * A flat 10_000-cents ($100) was previously applied to every currency, which is
 * 100x wrong for zero-decimal currencies (¥ has no cents) and doesn't allow a
 * rounder figure elsewhere. Currencies absent from the map fall back to ~100
 * major units, so every existing 2-decimal currency keeps its $100 minimum.
 */
const WITHDRAW_MINIMUM_BY_CURRENCY: Record<string, number> = {
  jpy: 10_000, // ¥10,000 (zero-decimal)
  krw: 100_000, // ₩100,000 (zero-decimal)
};

/** Minimum balance (smallest unit) a host must clear to withdraw `currency`. */
export function withdrawMinimum(currency: string): number {
  const c = currency.toLowerCase();
  return WITHDRAW_MINIMUM_BY_CURRENCY[c] ?? 100 * minorPerUnit(c);
}

/** How much a paid event type charges to book: the deposit if set (< price), else full price. */
export function chargeFor(price: number | null, depositAmount: number | null): number {
  if (!price || price <= 0) return 0;
  if (depositAmount && depositAmount > 0 && depositAmount < price) return depositAmount;
  return price;
}
