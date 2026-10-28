import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { capWindow } from "./caps";

const ZONE = "America/New_York";
const localISO = (d: Date) => DateTime.fromJSDate(d).setZone(ZONE).toISO();
const at = (o: Parameters<typeof DateTime.fromObject>[0]) =>
  DateTime.fromObject(o, { zone: ZONE }).toJSDate();

describe("capWindow", () => {
  it("day window is the host-local calendar day", () => {
    const { start, end } = capWindow("day", at({ year: 2026, month: 6, day: 15, hour: 14 }), ZONE);
    expect(localISO(start)).toBe(
      DateTime.fromObject({ year: 2026, month: 6, day: 15 }, { zone: ZONE }).toISO(),
    );
    expect(localISO(end)).toBe(
      DateTime.fromObject({ year: 2026, month: 6, day: 16 }, { zone: ZONE }).toISO(),
    );
  });

  it("month window is the host-local calendar month", () => {
    const { start, end } = capWindow("month", at({ year: 2026, month: 2, day: 17, hour: 9 }), ZONE);
    expect(localISO(start)).toBe(
      DateTime.fromObject({ year: 2026, month: 2, day: 1 }, { zone: ZONE }).toISO(),
    );
    expect(localISO(end)).toBe(
      DateTime.fromObject({ year: 2026, month: 3, day: 1 }, { zone: ZONE }).toISO(),
    );
  });

  it("year window is the host-local calendar year", () => {
    const { start, end } = capWindow("year", at({ year: 2026, month: 7, day: 4 }), ZONE);
    expect(localISO(start)).toBe(
      DateTime.fromObject({ year: 2026, month: 1, day: 1 }, { zone: ZONE }).toISO(),
    );
    expect(localISO(end)).toBe(
      DateTime.fromObject({ year: 2027, month: 1, day: 1 }, { zone: ZONE }).toISO(),
    );
  });

  it("week window stays a real local week across a spring-forward DST change", () => {
    // US spring-forward is Sun 2026-03-08; the Mon-based week containing it is
    // Mar 2 -> Mar 9, which loses an hour, so the UTC span is 167h, not 168h.
    const { start, end } = capWindow("week", at({ year: 2026, month: 3, day: 8, hour: 12 }), ZONE);
    const s = DateTime.fromJSDate(start).setZone(ZONE);
    expect(s.toISO()).toBe(s.startOf("week").toISO()); // aligned to week start
    expect(localISO(end)).toBe(s.plus({ weeks: 1 }).toISO()); // exactly one local week later
    expect(end.getTime() - start.getTime()).toBe(167 * 60 * 60 * 1000); // DST-correct, not naive 168h
  });
});
