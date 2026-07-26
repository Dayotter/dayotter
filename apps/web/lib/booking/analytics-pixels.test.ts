import { describe, expect, it } from "vitest";
import { hasAnyPixel, isValidPixelId, sanitizePixelConfig } from "./analytics-pixels";

describe("isValidPixelId", () => {
  it("accepts well-formed provider IDs", () => {
    expect(isValidPixelId("ga4", "G-ABCDE12345")).toBe(true);
    expect(isValidPixelId("gtm", "GTM-ABC123")).toBe(true);
    expect(isValidPixelId("metaPixel", "1234567890")).toBe(true);
    expect(isValidPixelId("fathom", "ABCDEFGH")).toBe(true);
    expect(isValidPixelId("plausible", "book.acme.com")).toBe(true);
  });

  it("rejects malformed IDs and anything with markup / whitespace", () => {
    expect(isValidPixelId("ga4", "UA-12345")).toBe(false);
    expect(isValidPixelId("gtm", "ABC123")).toBe(false);
    expect(isValidPixelId("metaPixel", "12ab")).toBe(false);
    expect(isValidPixelId("plausible", "https://acme.com")).toBe(false);
    // the whole point: no script/HTML can pass a validator
    expect(isValidPixelId("ga4", "G-1</script><script>alert(1)")).toBe(false);
    expect(isValidPixelId("fathom", "AB CD")).toBe(false);
  });
});

describe("sanitizePixelConfig", () => {
  it("keeps valid ids (trimmed) and drops invalid/empty ones", () => {
    const out = sanitizePixelConfig({
      ga4: "  G-ABCDE12345 ",
      gtm: "not-a-container",
      metaPixel: "999888777",
      fathom: "",
      plausible: "acme.com",
      extra: "ignored",
    });
    expect(out).toEqual({
      ga4: "G-ABCDE12345",
      metaPixel: "999888777",
      plausible: "acme.com",
    });
  });

  it("returns {} for non-objects / junk", () => {
    expect(sanitizePixelConfig(null)).toEqual({});
    expect(sanitizePixelConfig("G-123")).toEqual({});
    expect(sanitizePixelConfig({ ga4: 123 })).toEqual({});
  });

  it("never lets a script snippet through any field", () => {
    const evil = "<script>alert(1)</script>";
    const out = sanitizePixelConfig({
      ga4: evil,
      gtm: evil,
      metaPixel: evil,
      fathom: evil,
      plausible: evil,
    });
    expect(out).toEqual({});
  });
});

describe("hasAnyPixel", () => {
  it("is false for empty, true when any provider is set", () => {
    expect(hasAnyPixel({})).toBe(false);
    expect(hasAnyPixel({ ga4: "G-ABCDE12345" })).toBe(true);
  });
});
