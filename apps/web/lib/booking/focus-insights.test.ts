import { describe, expect, it } from "vitest";
import { computeFocusMetrics } from "./focus-insights";

const m = (s: string, e: string) => ({ start: new Date(s), end: new Date(e) });

describe("computeFocusMetrics", () => {
  it("returns zeros for no meetings", () => {
    const f = computeFocusMetrics([], "UTC");
    expect(f.busyDays).toBe(0);
    expect(f.avgMeetingsPerBusyDay).toBe(0);
  });

  it("counts busy days and per-day averages by local day", () => {
    const f = computeFocusMetrics(
      [
        m("2026-07-13T09:00:00Z", "2026-07-13T09:30:00Z"),
        m("2026-07-13T11:00:00Z", "2026-07-13T11:30:00Z"),
        m("2026-07-14T15:00:00Z", "2026-07-14T15:30:00Z"),
      ],
      "UTC",
    );
    expect(f.busyDays).toBe(2);
    expect(f.avgMeetingsPerBusyDay).toBe(1.5); // (2 + 1) / 2
  });

  it("flags fragmented days (3+ meetings) and rushed back-to-back pairs", () => {
    const f = computeFocusMetrics(
      [
        m("2026-07-13T09:00:00Z", "2026-07-13T09:30:00Z"),
        m("2026-07-13T09:35:00Z", "2026-07-13T10:00:00Z"), // 5-min gap → rushed
        m("2026-07-13T13:00:00Z", "2026-07-13T13:30:00Z"), // big gap
      ],
      "UTC",
    );
    expect(f.fragmentedDaysPct).toBe(100); // the one day has 3 meetings
    // 2 consecutive pairs; 1 rushed → 50%
    expect(f.backToBackPct).toBe(50);
    // longest gap that day: 13:00 - 10:00 = 180 min
    expect(f.avgLongestGapMin).toBe(180);
  });

  it("groups by the caller's timezone", () => {
    // Two meetings that are the same UTC day but different local days in Sydney.
    const f = computeFocusMetrics(
      [
        m("2026-07-13T13:00:00Z", "2026-07-13T13:30:00Z"),
        m("2026-07-13T15:00:00Z", "2026-07-13T15:30:00Z"),
      ],
      "Australia/Sydney",
    );
    // 13:00Z = 23:00 Mon, 15:00Z = 01:00 Tue in Sydney → 2 busy days
    expect(f.busyDays).toBe(2);
  });
});
