import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { focusBlockInput, timeBlockInput } from "./time-block";

describe("timeBlockInput", () => {
  it("accepts the offset-bearing ISO strings the dashboard actually sends", () => {
    // This is exactly how components/time-blocks.tsx builds the payload.
    const startISO = DateTime.fromFormat("2026-08-06T14:30", "yyyy-MM-dd'T'HH:mm", {
      zone: "Asia/Kolkata",
    }).toISO();
    const endISO = DateTime.fromFormat("2026-08-06T15:30", "yyyy-MM-dd'T'HH:mm", {
      zone: "Asia/Kolkata",
    }).toISO();

    // Guard the regression: toISO() emits a numeric offset, never a bare `Z`.
    expect(startISO).toMatch(/\+05:30$/);

    const parsed = timeBlockInput.safeParse({
      title: "Deep work",
      kind: "focus",
      startsAt: startISO,
      endsAt: endISO,
      repeatWeeks: 0,
      timezone: "Asia/Kolkata",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts a numeric offset that is not on a whole hour", () => {
    // Nepal is +05:45 - a classic case that a naive `Z`-only check would reject.
    const startISO = DateTime.fromFormat("2026-08-06T14:30", "yyyy-MM-dd'T'HH:mm", {
      zone: "Asia/Kathmandu",
    }).toISO();
    expect(startISO).toMatch(/\+05:45$/);
    const parsed = timeBlockInput.safeParse({
      title: "Lunch",
      startsAt: startISO,
      endsAt: DateTime.fromISO(startISO!).plus({ hours: 1 }).toISO(),
    });
    expect(parsed.success).toBe(true);
  });

  it("still accepts the `Z` form (server round-trips toISOString())", () => {
    const parsed = timeBlockInput.safeParse({
      title: "Focus",
      startsAt: "2026-08-06T09:00:00.000Z",
      endsAt: "2026-08-06T10:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-datetime string", () => {
    const parsed = timeBlockInput.safeParse({
      title: "Bad",
      startsAt: "not-a-date",
      endsAt: "2026-08-06T10:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults kind, repeatWeeks and timezone", () => {
    const parsed = timeBlockInput.parse({
      title: "Focus",
      startsAt: "2026-08-06T09:00:00.000Z",
      endsAt: "2026-08-06T10:00:00.000Z",
    });
    expect(parsed.kind).toBe("focus");
    expect(parsed.repeatWeeks).toBe(0);
    expect(parsed.timezone).toBe("UTC");
  });
});

describe("focusBlockInput", () => {
  it("accepts an offset-bearing startISO from the assistant", () => {
    const startISO = DateTime.fromFormat("2026-08-06T14:30", "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    }).toISO();
    const parsed = focusBlockInput.safeParse({ startISO, durationMinutes: 60 });
    expect(parsed.success).toBe(true);
  });

  it("bounds durationMinutes to 15..480", () => {
    const base = { startISO: "2026-08-06T09:00:00.000Z" };
    expect(focusBlockInput.safeParse({ ...base, durationMinutes: 10 }).success).toBe(false);
    expect(focusBlockInput.safeParse({ ...base, durationMinutes: 500 }).success).toBe(false);
    expect(focusBlockInput.safeParse({ ...base, durationMinutes: 60 }).success).toBe(true);
  });
});
