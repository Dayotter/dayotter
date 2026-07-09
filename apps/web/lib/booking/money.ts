/** Currency + money helpers — client-safe (no Stripe SDK), shared by the form,
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

/** Format minor units + currency for display, e.g. (2500, "usd") → "$25.00". */
export function formatMoney(minor: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency as Currency] ?? "";
  return sym
    ? `${sym}${(minor / 100).toFixed(2)}`
    : `${(minor / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

/** How much a paid event type charges to book: the deposit if set (< price), else full price. */
export function chargeFor(price: number | null, depositAmount: number | null): number {
  if (!price || price <= 0) return 0;
  if (depositAmount && depositAmount > 0 && depositAmount < price) return depositAmount;
  return price;
}
