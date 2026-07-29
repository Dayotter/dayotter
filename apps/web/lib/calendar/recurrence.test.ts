import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { recurringBlockOccurrences } from "./recurrence";

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
