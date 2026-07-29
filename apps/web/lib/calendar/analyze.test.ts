import { describe, expect, it } from "vitest";
import { type BusyItem, analyzeSchedule } from "./analyze";

const d = (iso: string) => new Date(iso);
const item = (title: string, start: string, end: string, source = "booking"): BusyItem => ({
  title,
  startsAt: d(start),
  endsAt: d(end),
  source,
});

describe("analyzeSchedule", () => {
  const from = d("2026-07-30T00:00:00Z");
  const to = d("2026-07-31T00:00:00Z");

  it("counts commitments, sums busy hours, and breaks down by source", () => {
    const a = analyzeSchedule(
      [
        item("Standup", "2026-07-30T09:00:00Z", "2026-07-30T09:30:00Z"),
        item("Design review", "2026-07-30T13:00:00Z", "2026-07-30T14:00:00Z", "external"),
        item("Deep work", "2026-07-30T15:00:00Z", "2026-07-30T16:30:00Z", "focus"),
      ],
      from,
      to,
      "UTC",
    );
    expect(a.commitmentCount).toBe(3);
    expect(a.busyHours).toBe(3); // 0.5 + 1 + 1.5
    expect(a.bySource).toEqual({ booking: 1, external: 1, focus: 1 });
    expect(a.firstStartISO).toBe("2026-07-30T09:00:00.000Z");
    expect(a.lastEndISO).toBe("2026-07-30T16:30:00.000Z"); // finish time
  });

  it("merges overlapping time so double-booked hours aren't counted twice", () => {
    const a = analyzeSchedule(
      [
        item("Call A", "2026-07-30T10:00:00Z", "2026-07-30T11:00:00Z"),
        item("Call B", "2026-07-30T10:30:00Z", "2026-07-30T11:30:00Z", "external"),
      ],
      from,
      to,
      "UTC",
    );
    expect(a.busyHours).toBe(1.5); // union 10:00-11:30, not 2h
    expect(a.conflicts).toHaveLength(1);
    expect(a.conflicts[0]).toMatchObject({
      a: "Call A",
      b: "Call B",
      startsAt: "2026-07-30T10:30:00.000Z",
      endsAt: "2026-07-30T11:00:00.000Z",
    });
  });

  it("reports the longest gap between consecutive commitments", () => {
    const a = analyzeSchedule(
      [
        item("Morning", "2026-07-30T09:00:00Z", "2026-07-30T09:30:00Z"),
        item("Afternoon", "2026-07-30T14:00:00Z", "2026-07-30T15:00:00Z"),
      ],
      from,
      to,
      "UTC",
    );
    expect(a.longestGapMinutes).toBe(270); // 09:30 -> 14:00
    expect(a.longestGapFromISO).toBe("2026-07-30T09:30:00.000Z");
    expect(a.longestGapToISO).toBe("2026-07-30T14:00:00.000Z");
  });

  it("buckets busiest day in the host's timezone", () => {
    // 23:00 UTC on the 30th is 19:00 in New York (still the 30th locally).
    const a = analyzeSchedule(
      [item("Late call", "2026-07-30T23:00:00Z", "2026-07-31T00:00:00Z")],
      d("2026-07-30T00:00:00Z"),
      d("2026-07-31T12:00:00Z"),
      "America/New_York",
    );
    expect(a.busiestDay?.date).toBe("2026-07-30");
  });

  it("handles an empty window", () => {
    const a = analyzeSchedule([], from, to, "UTC");
    expect(a.commitmentCount).toBe(0);
    expect(a.busyHours).toBe(0);
    expect(a.busiestDay).toBeNull();
    expect(a.firstStartISO).toBeNull();
    expect(a.longestGapMinutes).toBeNull();
    expect(a.conflicts).toEqual([]);
  });

  it("ignores items outside the window", () => {
    const a = analyzeSchedule(
      [
        item("Before", "2026-07-29T10:00:00Z", "2026-07-29T11:00:00Z"),
        item("Inside", "2026-07-30T10:00:00Z", "2026-07-30T11:00:00Z"),
      ],
      from,
      to,
      "UTC",
    );
    expect(a.commitmentCount).toBe(1);
    expect(a.busyHours).toBe(1);
  });
});
