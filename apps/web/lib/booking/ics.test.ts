import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "./ics";

const base = {
  uid: "abc-123",
  title: "Intro Call",
  description: null as string | null,
  start: new Date("2026-07-08T09:00:00Z"),
  end: new Date("2026-07-08T09:30:00Z"),
  location: null as string | null,
  meetingUrl: null as string | null,
};

describe("buildIcs", () => {
  it("emits a valid VCALENDAR with UTC times and CRLF line endings", () => {
    const ics = buildIcs(base);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART:20260708T090000Z");
    expect(ics).toContain("DTEND:20260708T093000Z");
    expect(ics).toContain("UID:abc-123@calsync");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("escapes special characters in text fields (RFC 5545)", () => {
    const ics = buildIcs({ ...base, title: "A; B, C\\D\nE" });
    expect(ics).toContain("SUMMARY:A\\; B\\, C\\\\D\\nE");
  });

  it("omits DESCRIPTION and LOCATION lines when absent", () => {
    const ics = buildIcs(base);
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("prefers meetingUrl over location for LOCATION", () => {
    expect(buildIcs({ ...base, location: "Room 4", meetingUrl: "https://meet/x" })).toContain(
      "LOCATION:https://meet/x",
    );
    expect(buildIcs({ ...base, location: "Room 4" })).toContain("LOCATION:Room 4");
  });

  it("formats UTC regardless of the local timezone", () => {
    // A date given in a +offset zone still renders in Z.
    const ics = buildIcs({ ...base, start: new Date("2026-07-08T11:00:00+02:00") });
    expect(ics).toContain("DTSTART:20260708T090000Z");
  });
});

describe("googleCalendarUrl", () => {
  it("builds a template URL with UTC dates and encoded params", () => {
    const url = new URL(
      googleCalendarUrl({ ...base, description: "Chat & plan", meetingUrl: "https://meet/x" }),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Intro Call");
    expect(url.searchParams.get("dates")).toBe("20260708T090000Z/20260708T093000Z");
    expect(url.searchParams.get("details")).toContain("Chat & plan");
    expect(url.searchParams.get("details")).toContain("https://meet/x");
  });
});
