import { describe, expect, it } from "vitest";
import { marketingRedirect } from "./marketing-gate";

describe("marketingRedirect", () => {
  it("leaves every page alone when the marketing site is on (the default)", () => {
    expect(marketingRedirect("/", undefined)).toBeNull();
    expect(marketingRedirect("/pricing", "")).toBeNull();
    expect(marketingRedirect("/blog/some-post", "on")).toBeNull();
  });

  it("sends the home page to the app when marketing is off", () => {
    expect(marketingRedirect("/", "off")).toBe("/dashboard");
  });

  it("sends marketing pages and their subpages to the app when off", () => {
    for (const p of ["/pricing", "/features", "/docs", "/blog/some-post", "/vs/calendly"]) {
      expect(marketingRedirect(p, "off")).toBe("/dashboard");
    }
  });

  it("keeps the legal pages the sign-in screen links to", () => {
    expect(marketingRedirect("/privacy", "off")).toBeNull();
    expect(marketingRedirect("/terms", "off")).toBeNull();
  });

  it("never touches the app, auth or public booking pages", () => {
    for (const p of ["/dashboard", "/sign-in", "/enzo/intro", "/book/abc", "/api/health"]) {
      expect(marketingRedirect(p, "off")).toBeNull();
    }
  });

  it("does not match a handle that merely starts like a marketing path", () => {
    expect(marketingRedirect("/pricingteam", "off")).toBeNull();
  });
});
