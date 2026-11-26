import { describe, expect, it } from "vitest";
import { WINDOW_DAYS, jumpTarget, slotWindow } from "./slot-window";

const DAY = 86_400_000;
const now = Date.parse("2026-11-24T12:00:00Z");

describe("slotWindow", () => {
  it("starts at now and spans two weeks by default", () => {
    const w = slotWindow(null, now, null);
    expect(w.from).toBe(now);
    expect(w.to).toBe(now + WINDOW_DAYS * DAY);
    expect(w.hasPrev).toBe(false);
  });

  it("never starts in the past", () => {
    expect(slotWindow(now - 3 * DAY, now, null).from).toBe(now);
  });

  it("offers no next window when the booking limit fits in the first one", () => {
    // A type that kept a short window looks exactly as before: no navigation.
    const w = slotWindow(null, now, now + 7 * DAY);
    expect(w.hasNext).toBe(false);
    expect(w.hasPrev).toBe(false);
  });

  it("offers a next window while the booking limit lies beyond this one", () => {
    expect(slotWindow(null, now, now + 365 * DAY).hasNext).toBe(true);
    expect(slotWindow(null, now, null).hasNext).toBe(true);
  });

  it("stops at the booking limit", () => {
    const limit = now + 60 * DAY;
    expect(slotWindow(now + 42 * DAY, now, limit).hasNext).toBe(true);
    expect(slotWindow(now + 46 * DAY, now, limit).hasNext).toBe(false);
  });

  it("allows going back once moved forward", () => {
    expect(slotWindow(now + WINDOW_DAYS * DAY, now, null).hasPrev).toBe(true);
  });

  it("reaches April 2027 from November 2026 within a 365-day limit", () => {
    const april = Date.parse("2027-04-14T03:00:00Z");
    const w = slotWindow(april, now, now + 365 * DAY);
    expect(w.from).toBe(april);
    expect(w.to).toBe(april + WINDOW_DAYS * DAY);
  });

  it("ignores a few seconds of clock skew against the server limit", () => {
    // A 14-day type seen from a phone running 5 s behind must not page to an empty window.
    expect(slotWindow(null, now - 5_000, now + WINDOW_DAYS * DAY).hasNext).toBe(false);
  });
});

describe("jumpTarget", () => {
  const today = Date.parse("2026-11-24T03:00:00Z"); // local midnight in Sao Paulo

  it("ignores a day before today (e.g. a year half-typed as 0202)", () => {
    expect(jumpTarget(Date.parse("0202-04-14T03:00:00Z"), now, null)).toBeNull();
    expect(jumpTarget(today - DAY, now, null)).toBeNull();
  });

  it("goes to today or any later day when unlimited", () => {
    expect(jumpTarget(today, now, null)).toBe(today);
    expect(jumpTarget(today + 141 * DAY, now, null)).toBe(today + 141 * DAY);
  });

  it("keeps a typed day past the limit inside the last bookable window", () => {
    const limit = now + 60 * DAY;
    expect(jumpTarget(today + 30 * DAY, now, limit)).toBe(today + 30 * DAY);
    expect(jumpTarget(today + 200 * DAY, now, limit)).toBe(limit - WINDOW_DAYS * DAY);
  });
});
