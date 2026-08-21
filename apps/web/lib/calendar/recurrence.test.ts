import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { recurringBlockOccurrences, seriesOccurrences } from "./recurrence";

// A fixed "now": Wed 2026-07-29 08:00 UTC.
const NOW = new Date("2026-07-29T08:00:00Z");

describe("recurringBlockOccurrences", () => {
  it("places a block on each selected weekday for the given weeks", () => {
    // Weekdays Mon-Fri (1..5), 2 weeks → 10 occurrences (none skipped, all future).
    const occ = recurringBlockOccurrences(
      {
        daysOfWeek: [1, 2, 3, 4, 5],
        start: "12:00",
        durationMinutes: 60,
        weeks: 2,
        timezone: "UTC",
      },
      NOW,
    );
    expect(occ).toHaveLength(10);
    // Each is 60 minutes.
    for (const o of occ) {
      expect((o.endsAt.getTime() - o.startsAt.getTime()) / 60_000).toBe(60);
    }
    // All land at 12:00 UTC and only on weekdays.
    for (const o of occ) {
      const dt = DateTime.fromJSDate(o.startsAt, { zone: "UTC" });
      expect(dt.hour).toBe(12);
      expect(dt.weekday).toBeLessThanOrEqual(5); // Mon-Fri
    }
  });

  it("skips occurrences that are already in the past", () => {
    // "now" is Wed 08:00 UTC. A Wednesday 07:00 block this week is in the past
    // and must be skipped; the next Wednesday is kept.
    const occ = recurringBlockOccurrences(
      { daysOfWeek: [3], start: "07:00", durationMinutes: 30, weeks: 2, timezone: "UTC" },
      NOW,
    );
    expect(occ).toHaveLength(1);
    expect(DateTime.fromJSDate(occ[0]!.startsAt, { zone: "UTC" }).toISODate()).toBe("2026-08-05");
  });

  it("keeps a later-today occurrence (only strictly-past is skipped)", () => {
    // Wednesday 14:00 is still ahead of 08:00 now → kept this week.
    const occ = recurringBlockOccurrences(
      { daysOfWeek: [3], start: "14:00", durationMinutes: 30, weeks: 1, timezone: "UTC" },
      NOW,
    );
    expect(occ).toHaveLength(1);
    expect(DateTime.fromJSDate(occ[0]!.startsAt, { zone: "UTC" }).toISODate()).toBe("2026-07-29");
  });

  it("resolves the local start time in the host timezone (DST-safe)", () => {
    // 09:00 in New York in August is 13:00 UTC (EDT, UTC-4).
    const occ = recurringBlockOccurrences(
      {
        daysOfWeek: [1],
        start: "09:00",
        durationMinutes: 30,
        weeks: 1,
        timezone: "America/New_York",
      },
      NOW,
    );
    expect(occ).toHaveLength(1);
    expect(occ[0]!.startsAt.toISOString()).toBe("2026-08-03T13:00:00.000Z");
  });

  it("caps the total number of occurrences", () => {
    const occ = recurringBlockOccurrences(
      {
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        start: "10:00",
        durationMinutes: 30,
        weeks: 52,
        timezone: "UTC",
      },
      NOW,
      60,
    );
    expect(occ).toHaveLength(60);
  });

  it("returns nothing for a malformed start time", () => {
    expect(
      recurringBlockOccurrences(
        { daysOfWeek: [1], start: "nope", durationMinutes: 30, weeks: 1, timezone: "UTC" },
        NOW,
      ),
    ).toEqual([]);
  });
});

describe("seriesOccurrences", () => {
  // Monday 2026-08-03 09:00 UTC (NOW is the Wed before).
  const MON = new Date("2026-08-03T09:00:00Z");

  it("returns a single occurrence for freq none", () => {
    const occ = seriesOccurrences({
      start: MON,
      durationMinutes: 30,
      freq: "none",
      daysOfWeek: [],
      count: 5,
      timezone: "UTC",
    });
    expect(occ).toHaveLength(1);
    expect(occ[0]!.startsAt.toISOString()).toBe("2026-08-03T09:00:00.000Z");
  });

  it("returns a single occurrence when count is 1, whatever the freq", () => {
    const occ = seriesOccurrences({
      start: MON,
      durationMinutes: 30,
      freq: "weekly",
      daysOfWeek: [1],
      count: 1,
      timezone: "UTC",
    });
    expect(occ).toHaveLength(1);
  });

  it("places back-to-back same-day slots for consecutive", () => {
    const occ = seriesOccurrences({
      start: new Date("2026-08-03T14:00:00Z"),
      durationMinutes: 15,
      freq: "consecutive",
      daysOfWeek: [],
      count: 3,
      timezone: "UTC",
    });
    expect(occ.map((o) => o.startsAt.toISOString())).toEqual([
      "2026-08-03T14:00:00.000Z",
      "2026-08-03T14:15:00.000Z",
      "2026-08-03T14:30:00.000Z",
    ]);
  });

  it("expands weekdays and keeps the start as the first occurrence", () => {
    const occ = seriesOccurrences({
      start: MON,
      durationMinutes: 30,
      freq: "weekdays",
      daysOfWeek: [],
      count: 10,
      timezone: "UTC",
    });
    expect(occ).toHaveLength(10);
    expect(occ[0]!.startsAt.toISOString()).toBe("2026-08-03T09:00:00.000Z");
    for (const o of occ) {
      expect(DateTime.fromJSDate(o.startsAt, { zone: "UTC" }).weekday).toBeLessThanOrEqual(5);
    }
  });

  it("expands weekly on the given days", () => {
    const occ = seriesOccurrences({
      start: MON,
      durationMinutes: 30,
      freq: "weekly",
      daysOfWeek: [1],
      count: 4,
      timezone: "UTC",
    });
    expect(occ.map((o) => DateTime.fromJSDate(o.startsAt, { zone: "UTC" }).toISODate())).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ]);
  });

  it("weekly with no explicit day repeats on the start's weekday", () => {
    const wed = new Date("2026-07-29T14:00:00Z"); // Wednesday, ahead of NOW
    const occ = seriesOccurrences({
      start: wed,
      durationMinutes: 30,
      freq: "weekly",
      daysOfWeek: [],
      count: 2,
      timezone: "UTC",
    });
    expect(occ.map((o) => DateTime.fromJSDate(o.startsAt, { zone: "UTC" }).toISODate())).toEqual([
      "2026-07-29",
      "2026-08-05",
    ]);
  });

  it("clamps the total to at most 60", () => {
    const occ = seriesOccurrences({
      start: MON,
      durationMinutes: 30,
      freq: "daily",
      daysOfWeek: [],
      count: 999,
      timezone: "UTC",
    });
    expect(occ).toHaveLength(60);
  });
});
