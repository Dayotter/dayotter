import { describe, expect, it } from "vitest";
import { chargeFor, formatMoney, minorPerUnit, withdrawMinimum } from "./money";

describe("minorPerUnit", () => {
  it("is 100 for normal two-decimal currencies", () => {
    expect(minorPerUnit("usd")).toBe(100);
    expect(minorPerUnit("eur")).toBe(100);
    expect(minorPerUnit("inr")).toBe(100);
  });

  it("is 1 for zero-decimal currencies, case-insensitively", () => {
    expect(minorPerUnit("jpy")).toBe(1);
    expect(minorPerUnit("JPY")).toBe(1);
    expect(minorPerUnit("krw")).toBe(1);
  });

  it("defaults unknown currencies to two decimals", () => {
    expect(minorPerUnit("xyz")).toBe(100);
  });
});

describe("formatMoney", () => {
  it("renders two-decimal currencies with the symbol", () => {
    expect(formatMoney(2500, "usd")).toBe("$25.00");
    expect(formatMoney(10_000, "eur")).toBe("€100.00");
    expect(formatMoney(0, "gbp")).toBe("£0.00");
  });

  it("does not divide zero-decimal currencies by 100", () => {
    // ¥10,000 is 10000 whole yen - the old /100 wrongly rendered it as 100.00.
    expect(formatMoney(10_000, "jpy")).toBe("10000 JPY");
    expect(formatMoney(500, "jpy")).toBe("500 JPY");
  });

  it("falls back to an uppercased code when there is no symbol", () => {
    expect(formatMoney(2500, "chf")).toBe("25.00 CHF");
    expect(formatMoney(10_000, "krw")).toBe("10000 KRW");
  });
});

describe("withdrawMinimum", () => {
  it("keeps the $100 minimum for every two-decimal currency", () => {
    for (const c of ["usd", "eur", "gbp", "cad", "aud", "inr"]) {
      expect(withdrawMinimum(c)).toBe(10_000);
    }
  });

  it("uses whole-unit minimums for zero-decimal currencies", () => {
    // Not 10_000 cents (which for ¥ would be ¥10,000-as-cents = 100x wrong).
    expect(withdrawMinimum("jpy")).toBe(10_000); // ¥10,000
    expect(withdrawMinimum("krw")).toBe(100_000); // ₩100,000
  });

  it("is case-insensitive", () => {
    expect(withdrawMinimum("USD")).toBe(10_000);
    expect(withdrawMinimum("JPY")).toBe(10_000);
  });

  it("falls back to ~100 major units for an unmapped currency", () => {
    expect(withdrawMinimum("chf")).toBe(10_000); // two-decimal fallback
  });
});

describe("chargeFor", () => {
  it("is zero when the event type is free", () => {
    expect(chargeFor(null, null)).toBe(0);
    expect(chargeFor(0, 5000)).toBe(0);
  });

  it("charges the full price when there is no deposit", () => {
    expect(chargeFor(5000, null)).toBe(5000);
    expect(chargeFor(5000, 0)).toBe(5000);
  });

  it("charges the deposit only when it is a positive amount below the price", () => {
    expect(chargeFor(5000, 2000)).toBe(2000);
    expect(chargeFor(5000, 5000)).toBe(5000); // deposit == price → full price
    expect(chargeFor(5000, 6000)).toBe(5000); // deposit > price → full price
  });
});
