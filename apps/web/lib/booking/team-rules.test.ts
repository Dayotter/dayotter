import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { type TeamRule, teamRuleIntervals } from "./availability";

const rule = (r: Partial<TeamRule>): TeamRule => ({
  kind: "no_meeting",
  theDate: null,
  dayOfWeek: null,
  startMinute: null,
  endMinute: null,
  ...r,
});

describe("teamRuleIntervals", () => {
  const from = new Date("2026-07-13T00:00:00Z");
  const to = new Date("2026-07-20T00:00:00Z");

  it("blocks the whole local day for a holiday", () => {
    const out = teamRuleIntervals(
      [rule({ kind: "holiday", theDate: "2026-07-15" })],
      "UTC",
      from,
      to,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.start.toISOString()).toBe("2026-07-15T00:00:00.000Z");
    expect(out[0]?.end.toISOString()).toBe("2026-07-16T00:00:00.000Z");
  });

  it("blocks a weekly window only on the matching weekday", () => {
    // dayOfWeek 5 = Friday. Range 07-13(Mon)..07-20(Mon) → one Friday (07-17).
    const out = teamRuleIntervals(
      [rule({ dayOfWeek: 5, startMinute: 780, endMinute: 1020 })], // 13:00–17:00
      "UTC",
      from,
      to,
    );
    expect(out).toHaveLength(1);
    const s = DateTime.fromJSDate(out[0]!.start).toUTC();
    expect(s.weekday).toBe(5); // Friday
    expect(s.hour).toBe(13);
    expect(out[0]!.end.toISOString()).toBe("2026-07-17T17:00:00.000Z");
  });

  it("blocks every day when dayOfWeek is null", () => {
    const out = teamRuleIntervals([rule({ startMinute: 720, endMinute: 780 })], "UTC", from, to);
    // One interval per local day the range touches, 07-13..07-20 inclusive.
    expect(out.length).toBe(8);
  });

  it("keeps a window at the same local time across a DST boundary", () => {
    const out = teamRuleIntervals(
      [rule({ startMinute: 540, endMinute: 600 })], // 09:00–10:00 local
      "America/New_York",
      new Date("2026-03-07T00:00:00-05:00"),
      new Date("2026-03-09T23:59:00-04:00"),
    );
    for (const iv of out) {
      expect(DateTime.fromJSDate(iv.start).setZone("America/New_York").hour).toBe(9);
    }
  });

  it("ignores an inverted window and a holiday with no date", () => {
    const out = teamRuleIntervals(
      [rule({ startMinute: 600, endMinute: 500 }), rule({ kind: "holiday", theDate: null })],
      "UTC",
      from,
      to,
    );
    expect(out).toEqual([]);
  });
});
