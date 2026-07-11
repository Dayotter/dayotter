import { parseIcsEvents } from "@dayotter/calendar";
import { describe, expect, it } from "vitest";

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
LOCATION:Room 1
END:VEVENT
BEGIN:VEVENT
UID:free@test
DTSTART:20260710T150000Z
DTEND:20260710T160000Z
TRANSP:TRANSPARENT
SUMMARY:Free block
END:VEVENT
BEGIN:VEVENT
UID:cancelled@test
DTSTART:20260711T120000Z
DTEND:20260711T130000Z
STATUS:CANCELLED
SUMMARY:Cancelled
END:VEVENT
BEGIN:VEVENT
UID:daily@test
DTSTART:20260711T090000Z
DTEND:20260711T093000Z
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Standup
END:VEVENT
END:VCALENDAR`;

describe("parseIcsEvents (@dayotter/calendar)", () => {
  it("maps a plain VEVENT with a stable UID id and metadata", () => {
    const single = parseIcsEvents(ICS, FROM, TO).find((e) => e.externalEventId === "single@test");
    expect(single).toBeDefined();
    expect(single?.title).toBe("Single meeting");
    expect(single?.location).toBe("Room 1");
    expect(single?.transparency).toBe("opaque");
    expect(single?.start.toISOString()).toBe("2026-07-10T13:00:00.000Z");
  });

  it("keeps TRANSPARENT events but flags them free (so the busy projection can drop them)", () => {
    const free = parseIcsEvents(ICS, FROM, TO).find((e) => e.externalEventId === "free@test");
    expect(free?.transparency).toBe("transparent");
  });

  it("drops CANCELLED events entirely", () => {
    expect(
      parseIcsEvents(ICS, FROM, TO).some((e) => e.externalEventId.startsWith("cancelled@")),
    ).toBe(false);
  });

  it("expands recurrence into distinct, stable per-occurrence ids", () => {
    const standups = parseIcsEvents(ICS, FROM, TO).filter(
      (e) => e.recurringEventId === "daily@test",
    );
    expect(standups).toHaveLength(3);
    expect(standups.every((e) => e.isRecurring)).toBe(true);
    expect(new Set(standups.map((e) => e.externalEventId)).size).toBe(3);
    expect(standups.map((e) => e.externalEventId)).toContain("daily@test#2026-07-11T09:00:00.000Z");
  });

  it("returns [] for junk input", () => {
    expect(parseIcsEvents("not a calendar", FROM, TO)).toEqual([]);
  });
});
