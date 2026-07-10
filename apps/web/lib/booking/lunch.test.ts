import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { lunchIntervals } from "./availability";

describe("lunchIntervals", () => {
  it("emits one interval per local day at the right wall-clock time", () => {
    const tz = "America/New_York";
    const from = new Date("2026-07-13T00:00:00-04:00");
    const to = new Date("2026-07-15T23:59:00-04:00");
    const out = lunchIntervals(720, 780, tz, from, to); // 12:00–13:00
    expect(out).toHaveLength(3);
    for (const iv of out) {
      const s = DateTime.fromJSDate(iv.start).setZone(tz);
      const e = DateTime.fromJSDate(iv.end).setZone(tz);
      expect(s.hour).toBe(12);
      expect(s.minute).toBe(0);
      expect(e.hour).toBe(13);
    }
  });

  it("keeps 12:00 local across a DST spring-forward boundary (UTC offset shifts)", () => {
    const tz = "America/New_York";
    // US DST begins 2026-03-08; span a day before and after.
    const from = new Date("2026-03-07T12:00:00Z");
    const to = new Date("2026-03-09T12:00:00Z");
    const out = lunchIntervals(720, 780, tz, from, to);
    for (const iv of out) {
      expect(DateTime.fromJSDate(iv.start).setZone(tz).hour).toBe(12);
    }
  });

  it("returns [] for an inverted window", () => {
    expect(lunchIntervals(780, 720, "UTC", new Date(), new Date())).toEqual([]);
  });
});
