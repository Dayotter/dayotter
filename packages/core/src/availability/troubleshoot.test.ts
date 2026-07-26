import { describe, expect, it } from "vitest";
import { explainDay } from "./troubleshoot";
import type { AvailabilityInput, Schedule } from "./types";

// Mon–Fri 09:00–17:00 New York (matches engine.test.ts).
const nineToFive: Schedule = {
  timezone: "America/New_York",
  rules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "17:00" })),
  overrides: [],
};

// 2026-01-05 is a Monday; NY midnight = 05:00Z.
const onDay = (dateUtc: string, over: Partial<AvailabilityInput> = {}): AvailabilityInput => ({
  schedule: nineToFive,
  busy: [],
  event: {
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumNoticeMinutes: 0,
  },
  rangeStart: new Date(dateUtc),
  rangeEnd: new Date(dateUtc),
  now: new Date("2026-01-05T05:00:00Z"),
  ...over,
});

describe("explainDay", () => {
  it("reports a normal working day with all its slots", () => {
    const d = explainDay(onDay("2026-01-05T12:00:00Z")); // Monday
    expect(d.weekday).toBe("Monday");
    expect(d.dayOff).toBe(false);
    expect(d.totalSlots).toBe(16); // 09:00..16:30
    expect(d.bookableSlots).toBe(16);
    expect(d.scheduleWindows).toEqual([{ start: "09:00", end: "17:00" }]);
    expect(d.reasons.join(" ")).toMatch(/16 slots available/);
  });

  it("flags a day with no working hours (weekend)", () => {
    const d = explainDay(onDay("2026-01-04T12:00:00Z")); // Sunday
    expect(d.weekday).toBe("Sunday");
    expect(d.dayOff).toBe(true);
    expect(d.totalSlots).toBe(0);
    expect(d.reasons.join(" ")).toMatch(/No working hours are set for Sunday/);
  });

  it("attributes slots lost to busy time", () => {
    const d = explainDay(
      onDay("2026-01-05T12:00:00Z", {
        // 09:00–17:00 EST fully busy => everything blocked.
        busy: [{ start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T22:00:00Z") }],
      }),
    );
    expect(d.totalSlots).toBe(16);
    expect(d.bookableSlots).toBe(0);
    expect(d.blockedByBusy).toBe(16);
    expect(d.reasons.join(" ")).toMatch(/blocked by a busy event/);
  });

  it("attributes slots lost to minimum notice", () => {
    const d = explainDay(
      onDay("2026-01-05T12:00:00Z", {
        now: new Date("2026-01-05T14:00:00Z"), // 09:00 EST
        event: {
          durationMinutes: 30,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          minimumNoticeMinutes: 24 * 60, // pushes today's slots out
        },
      }),
    );
    expect(d.bookableSlots).toBe(0);
    expect(d.blockedByNoticeOrRange).toBe(16);
    expect(d.reasons.join(" ")).toMatch(/minimum-notice/);
  });

  it("honors a date override that closes the day", () => {
    const d = explainDay(
      onDay("2026-01-05T12:00:00Z", {
        schedule: {
          ...nineToFive,
          overrides: [{ date: "2026-01-05", startTime: null, endTime: null }],
        },
      }),
    );
    expect(d.dayOff).toBe(true);
    expect(d.override).not.toBeNull();
    expect(d.reasons.join(" ")).toMatch(/marked unavailable/);
  });

  it("flags a day beyond the booking window", () => {
    const d = explainDay(
      onDay("2026-06-01T12:00:00Z", {
        event: {
          durationMinutes: 30,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          minimumNoticeMinutes: 0,
          bookingWindowDays: 30,
        },
      }),
    );
    expect(d.beyondBookingWindow).toBe(true);
    expect(d.reasons.join(" ")).toMatch(/beyond the 30-day booking window/);
  });
});
