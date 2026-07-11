import { describe, expect, it } from "vitest";
import { icsToBusy } from "./overlay";

const FROM = new Date("2026-07-10T00:00:00Z");
const TO = new Date("2026-07-20T00:00:00Z");

const ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//dayotter test//EN
BEGIN:VEVENT
UID:single@test
DTSTART:20260710T130000Z
DTEND:20260710T140000Z
SUMMARY:Single meeting
END:VEVENT
BEGIN:VEVENT
UID:free@test
DTSTART:20260710T150000Z
DTEND:20260710T160000Z
TRANSP:TRANSPARENT
SUMMARY:Free block (should be ignored)
END:VEVENT
BEGIN:VEVENT
UID:cancelled@test
DTSTART:20260711T120000Z
DTEND:20260711T130000Z
STATUS:CANCELLED
SUMMARY:Cancelled (ignored)
END:VEVENT
BEGIN:VEVENT
UID:outside@test
DTSTART:20260701T090000Z
DTEND:20260701T100000Z
SUMMARY:Before the window (ignored)
END:VEVENT
BEGIN:VEVENT
UID:daily@test
DTSTART:20260711T090000Z
DTEND:20260711T093000Z
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Standup
END:VEVENT
END:VCALENDAR`;

describe("icsToBusy", () => {
  it("returns [] for junk input", () => {
    expect(icsToBusy("not a calendar", FROM, TO)).toEqual([]);
  });

  it("extracts a single busy interval and skips free/cancelled/out-of-window", () => {
    const busy = icsToBusy(ICS, FROM, TO);
    // single (1) + daily recurrence 07/11,07/12,07/13 (3) = 4
    expect(busy).toHaveLength(4);
    expect(busy[0]).toEqual({
      start: "2026-07-10T13:00:00.000Z",
      end: "2026-07-10T14:00:00.000Z",
    });
  });

  it("expands a daily RRULE within the window", () => {
    const busy = icsToBusy(ICS, FROM, TO);
    const standups = busy.filter((b) => b.start.endsWith("T09:00:00.000Z"));
    expect(standups.map((b) => b.start)).toEqual([
      "2026-07-11T09:00:00.000Z",
      "2026-07-12T09:00:00.000Z",
      "2026-07-13T09:00:00.000Z",
    ]);
  });

  it("returns intervals in chronological order", () => {
    const busy = icsToBusy(ICS, FROM, TO);
    const times = busy.map((b) => new Date(b.start).getTime());
    expect(times).toEqual([...times].sort((a, z) => a - z));
  });
});
