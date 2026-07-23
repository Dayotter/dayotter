import { describe, expect, it } from "vitest";
import {
  APPS,
  APP_CATEGORIES,
  type AppDefinition,
  type ConnectionState,
  appsByCategory,
  isConfigured,
  isConnected,
  searchApps,
} from "./registry";

const emptyState = (): ConnectionState => ({
  calendars: new Set(),
  crm: new Set(),
  conferencing: new Set(),
  stripe: false,
});

describe("registry integrity", () => {
  it("has unique ids", () => {
    const ids = APPS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses known categories", () => {
    for (const a of APPS) expect(APP_CATEGORIES).toContain(a.category);
  });

  it("gives every app a name, blurb, colour and href", () => {
    for (const a of APPS) {
      expect(a.name.length).toBeGreaterThan(0);
      expect(a.blurb.length).toBeGreaterThan(0);
      expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(a.href.startsWith("/")).toBe(true);
    }
  });

  it("marks OAuth-redirect apps as external API routes", () => {
    for (const a of APPS.filter((x) => x.external)) {
      expect(a.href.startsWith("/api/")).toBe(true);
    }
  });

  it("never marks an app both built-in and connectable", () => {
    for (const a of APPS) expect(a.builtIn && a.connection).toBeFalsy();
  });
});

describe("isConfigured", () => {
  const app = (requiresEnv?: string[]): AppDefinition => ({
    id: "x",
    name: "X",
    category: "crm",
    blurb: "b",
    color: "#000000",
    href: "/x",
    requiresEnv,
  });

  it("is true when the app needs no env", () => {
    expect(isConfigured(app(), {})).toBe(true);
    expect(isConfigured(app([]), {})).toBe(true);
  });
  it("requires every listed var to be non-empty", () => {
    expect(isConfigured(app(["A", "B"]), { A: "1", B: "2" })).toBe(true);
    expect(isConfigured(app(["A", "B"]), { A: "1" })).toBe(false);
    expect(isConfigured(app(["A"]), { A: "" })).toBe(false);
  });

  it("gates the real Zoom + Stripe entries on their env", () => {
    const zoom = APPS.find((a) => a.id === "zoom")!;
    expect(isConfigured(zoom, {})).toBe(false);
    expect(isConfigured(zoom, { ZOOM_CLIENT_ID: "a", ZOOM_CLIENT_SECRET: "b" })).toBe(true);
    const stripe = APPS.find((a) => a.id === "stripe")!;
    expect(isConfigured(stripe, { STRIPE_SECRET_KEY: "sk" })).toBe(true);
  });

  it("treats CalDAV / ICS as available on every deployment", () => {
    for (const id of ["apple-caldav", "ics-feed", "slack"]) {
      expect(isConfigured(APPS.find((a) => a.id === id)!, {})).toBe(true);
    }
  });
});

describe("isConnected", () => {
  const byId = (id: string) => APPS.find((a) => a.id === id)!;

  it("matches a calendar provider", () => {
    const s = emptyState();
    s.calendars.add("google");
    expect(isConnected(byId("google-calendar"), s)).toBe(true);
    expect(isConnected(byId("microsoft-outlook"), s)).toBe(false);
  });

  it("matches CRM and conferencing providers", () => {
    const s = emptyState();
    s.crm.add("hubspot");
    s.conferencing.add("zoom");
    expect(isConnected(byId("hubspot"), s)).toBe(true);
    expect(isConnected(byId("salesforce"), s)).toBe(false);
    expect(isConnected(byId("zoom"), s)).toBe(true);
  });

  it("matches stripe via the account flag", () => {
    const s = emptyState();
    expect(isConnected(byId("stripe"), s)).toBe(false);
    s.stripe = true;
    expect(isConnected(byId("stripe"), s)).toBe(true);
  });

  it("returns false for built-ins (always on, nothing to connect)", () => {
    expect(isConnected(byId("webhooks"), emptyState())).toBe(false);
    expect(isConnected(byId("google-meet"), emptyState())).toBe(false);
  });
});

describe("appsByCategory / searchApps", () => {
  it("groups in category order and skips empty groups", () => {
    const groups = appsByCategory();
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) expect(g.apps.length).toBeGreaterThan(0);
    // every app appears exactly once across groups
    expect(groups.reduce((n, g) => n + g.apps.length, 0)).toBe(APPS.length);
  });

  it("searches name and blurb, case-insensitively", () => {
    expect(searchApps("zoom").map((a) => a.id)).toContain("zoom");
    expect(searchApps("HUBSPOT").map((a) => a.id)).toContain("hubspot");
    // blurb match
    expect(searchApps("calendly").map((a) => a.id)).toContain("calendly-import");
    expect(searchApps("")).toHaveLength(APPS.length);
    expect(searchApps("no-such-app-xyz")).toHaveLength(0);
  });
});
