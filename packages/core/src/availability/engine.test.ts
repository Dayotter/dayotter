import { describe, expect, it } from "vitest";
import { computeAvailability, intersectAvailability } from "./engine";
import type { AvailabilityInput, Schedule } from "./types";

// Mon–Fri 09:00–17:00 in New York (EST / UTC-5 in January).
const nineToFive: Schedule = {
  timezone: "America/New_York",
  rules: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "17:00",
  })),
  overrides: [],
};

// 2026-01-05 is a Monday. Midnight EST == 05:00Z.
const base: AvailabilityInput = {
  schedule: nineToFive,
  busy: [],
  event: {
    durationMinutes: 30,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    minimumNoticeMinutes: 0,
  },
  rangeStart: new Date("2026-01-05T05:00:00Z"),
  rangeEnd: new Date("2026-01-06T05:00:00Z"),
  now: new Date("2026-01-05T05:00:00Z"),
};

describe("computeAvailability", () => {
  it("generates 30-min slots across a single working day", () => {
    const slots = computeAvailability(base);
    expect(slots).toHaveLength(16); // 09:00 .. 16:30
    expect(slots[0]!.start.toISOString()).toBe("2026-01-05T14:00:00.000Z"); // 09:00 EST
    expect(slots.at(-1)!.start.toISOString()).toBe("2026-01-05T21:30:00.000Z"); // 16:30 EST
  });

  it("excludes slots overlapping busy time", () => {
    const slots = computeAvailability({
      ...base,
      busy: [{ start: new Date("2026-01-05T15:00:00Z"), end: new Date("2026-01-05T16:00:00Z") }], // 10:00–11:00 EST
    });
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-01-05T15:00:00.000Z"); // 10:00
    expect(starts).not.toContain("2026-01-05T15:30:00.000Z"); // 10:30
    expect(slots).toHaveLength(14);
  });

  it("respects buffers around existing events", () => {
    // Busy 11:00–11:30 EST with a 15-min buffer before also blocks the 10:45 slot region.
    const slots = computeAvailability({
      ...base,
      event: { ...base.event, bufferAfterMinutes: 30 },
      busy: [{ start: new Date("2026-01-05T16:00:00Z"), end: new Date("2026-01-05T16:30:00Z") }], // 11:00–11:30
    });
    const starts = slots.map((s) => s.start.toISOString());
    // A 10:30 slot ends 11:00; +30m buffer reaches 11:30 -> overlaps busy -> excluded.
    expect(starts).not.toContain("2026-01-05T15:30:00.000Z"); // 10:30
  });

  it("honors minimum notice", () => {
    const slots = computeAvailability({
      ...base,
      now: new Date("2026-01-05T14:00:00Z"), // 09:00 EST
      event: { ...base.event, minimumNoticeMinutes: 120 }, // earliest 11:00 EST
    });
    expect(slots[0]!.start.toISOString()).toBe("2026-01-05T16:00:00.000Z"); // 11:00 EST
  });

  it("treats a date override with no times as a day off", () => {
    const slots = computeAvailability({
      ...base,
      schedule: {
        ...nineToFive,
        overrides: [{ date: "2026-01-05", startTime: null, endTime: null }],
      },
    });
    expect(slots).toHaveLength(0);
  });
});

describe("computeAvailability - constraints", () => {
  it("applies bufferBefore (guards the lead-in of a slot)", () => {
    // Busy 10:00–10:30 EST (15:00–15:30Z). Without a buffer the 10:30 slot is free.
    const busy = [
      { start: new Date("2026-01-05T15:00:00Z"), end: new Date("2026-01-05T15:30:00Z") },
    ];
    const noBuffer = computeAvailability({ ...base, busy }).map((s) => s.start.toISOString());
    expect(noBuffer).toContain("2026-01-05T15:30:00.000Z"); // 10:30 free without buffer

    const withBuffer = computeAvailability({
      ...base,
      busy,
      event: { ...base.event, bufferBeforeMinutes: 30 },
    }).map((s) => s.start.toISOString());
    // 10:30 slot's 30-min lead-in reaches back to 10:00 -> overlaps busy -> excluded.
    expect(withBuffer).not.toContain("2026-01-05T15:30:00.000Z");
  });

  it("drops slots beyond the booking window", () => {
    // Mon–Fri range, but only 1 day of lead allowed -> only Monday's slots.
    const slots = computeAvailability({
      ...base,
      rangeEnd: new Date("2026-01-10T05:00:00Z"),
      event: { ...base.event, bookingWindowDays: 1 },
    });
    expect(slots.length).toBe(16); // just Monday
    expect(slots.every((s) => s.start.getTime() < new Date("2026-01-06T05:00:00Z").getTime())).toBe(
      true,
    );
  });

  it("honors slotIntervalMinutes independent of duration", () => {
    const slots = computeAvailability({
      ...base,
      event: { ...base.event, slotIntervalMinutes: 15 }, // 30-min meetings on a 15-min cadence
    });
    expect(slots).toHaveLength(31); // 09:00..16:30 every 15 min
    const starts = slots.map((s) => s.start.toISOString());
    expect(starts).toContain("2026-01-05T14:15:00.000Z"); // 09:15
  });

  it("treats busy intervals as half-open (adjacent is not a conflict)", () => {
    // Busy 08:00–09:00 ends exactly when the 09:00 slot starts -> allowed.
    const adjacent = computeAvailability({
      ...base,
      busy: [{ start: new Date("2026-01-05T13:00:00Z"), end: new Date("2026-01-05T14:00:00Z") }],
    }).map((s) => s.start.toISOString());
    expect(adjacent).toContain("2026-01-05T14:00:00.000Z"); // 09:00 still free

    // Busy 09:00–09:30 truly overlaps the 09:00 slot -> excluded.
    const overlapping = computeAvailability({
      ...base,
      busy: [{ start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T14:30:00Z") }],
    }).map((s) => s.start.toISOString());
    expect(overlapping).not.toContain("2026-01-05T14:00:00.000Z");
  });

  it("excludes slots under multiple overlapping busy blocks", () => {
    const slots = computeAvailability({
      ...base,
      busy: [
        { start: new Date("2026-01-05T15:00:00Z"), end: new Date("2026-01-05T16:00:00Z") }, // 10:00–11:00
        { start: new Date("2026-01-05T15:30:00Z"), end: new Date("2026-01-05T16:30:00Z") }, // 10:30–11:30
      ],
    }).map((s) => s.start.toISOString());
    expect(slots).not.toContain("2026-01-05T15:00:00.000Z"); // 10:00
    expect(slots).not.toContain("2026-01-05T15:30:00.000Z"); // 10:30
    expect(slots).not.toContain("2026-01-05T16:00:00.000Z"); // 11:00
    expect(slots).toContain("2026-01-05T16:30:00.000Z"); // 11:30 free
  });

  it("honors a date override WITH custom hours", () => {
    const slots = computeAvailability({
      ...base,
      schedule: {
        ...nineToFive,
        overrides: [{ date: "2026-01-05", startTime: "12:00", endTime: "14:00" }],
      },
    });
    expect(slots).toHaveLength(4); // 12:00, 12:30, 13:00, 13:30
    expect(slots[0]!.start.toISOString()).toBe("2026-01-05T17:00:00.000Z"); // 12:00 EST
  });

  it("returns [] when the range is empty (min notice past the range)", () => {
    const slots = computeAvailability({
      ...base,
      now: new Date("2026-01-05T20:00:00Z"),
      event: { ...base.event, minimumNoticeMinutes: 24 * 60 }, // earliest is next day
    });
    expect(slots).toHaveLength(0);
  });
});

describe("timezone / DST correctness", () => {
  // The bug the user fears: schedule/host/booker timezones producing an
  // off-by-one-hour booking. US spring-forward is 2026-03-08 (EST->EDT).
  const singleDay = (dayStartUtc: string, dayEndUtc: string) => ({
    ...base,
    rangeStart: new Date(dayStartUtc),
    rangeEnd: new Date(dayEndUtc),
    now: new Date(dayStartUtc),
  });

  it("keeps 09:00 local before DST (EST, UTC-5)", () => {
    // Fri 2026-03-06, New York midnight == 05:00Z.
    const slots = computeAvailability(singleDay("2026-03-06T05:00:00Z", "2026-03-07T05:00:00Z"));
    expect(slots[0]!.start.toISOString()).toBe("2026-03-06T14:00:00.000Z"); // 09:00 EST
  });

  it("keeps 09:00 local after DST (EDT, UTC-4)", () => {
    // Mon 2026-03-09, New York midnight == 04:00Z (clocks sprang forward).
    const slots = computeAvailability(singleDay("2026-03-09T04:00:00Z", "2026-03-10T04:00:00Z"));
    // Correct engine: 09:00 EDT == 13:00Z (NOT 14:00Z - that would be the naive bug).
    expect(slots[0]!.start.toISOString()).toBe("2026-03-09T13:00:00.000Z");
  });
});

describe("intersectAvailability", () => {
  it("returns only slots common to every host", () => {
    const hostA = computeAvailability(base);
    const hostB = computeAvailability({
      ...base,
      busy: [{ start: new Date("2026-01-05T14:00:00Z"), end: new Date("2026-01-05T15:00:00Z") }], // A free 09:00, B busy
    });
    const shared = intersectAvailability([hostA, hostB]);
    const starts = shared.map((s) => s.start.toISOString());
    expect(starts).not.toContain("2026-01-05T14:00:00.000Z"); // 09:00 blocked for B
    expect(starts).toContain("2026-01-05T16:00:00.000Z"); // 11:00 free for both
  });
});
