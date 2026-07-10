import { describe, expect, it } from "vitest";
import { detectDuplicates } from "./inbox";

const NAMES = new Map([
  ["cal-a", "Work"],
  ["cal-b", "Personal"],
  ["cal-c", "Team"],
]);
const T = new Date("2026-07-15T10:00:00Z");
const T2 = new Date("2026-07-15T11:00:00Z");

describe("detectDuplicates", () => {
  it("flags the same meeting on two calendars", () => {
    const dupes = detectDuplicates(
      [
        { calendarId: "cal-a", title: "Standup", startsAt: T },
        { calendarId: "cal-b", title: "Standup", startsAt: T },
      ],
      NAMES,
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.calendars.sort()).toEqual(["Personal", "Work"]);
  });

  it("matches case/whitespace-insensitively but respects start time", () => {
    const dupes = detectDuplicates(
      [
        { calendarId: "cal-a", title: "  Team  Sync ", startsAt: T },
        { calendarId: "cal-b", title: "team sync", startsAt: T },
        { calendarId: "cal-c", title: "Team Sync", startsAt: T2 }, // different time → not a dupe
      ],
      NAMES,
    );
    expect(dupes).toHaveLength(1);
    expect(dupes[0]?.calendars).toHaveLength(2);
  });

  it("does not flag the same event twice on the SAME calendar", () => {
    const dupes = detectDuplicates(
      [
        { calendarId: "cal-a", title: "Focus", startsAt: T },
        { calendarId: "cal-a", title: "Focus", startsAt: T },
      ],
      NAMES,
    );
    expect(dupes).toEqual([]);
  });

  it("ignores untitled busy blocks", () => {
    const dupes = detectDuplicates(
      [
        { calendarId: "cal-a", title: null, startsAt: T },
        { calendarId: "cal-b", title: "   ", startsAt: T },
      ],
      NAMES,
    );
    expect(dupes).toEqual([]);
  });
});
