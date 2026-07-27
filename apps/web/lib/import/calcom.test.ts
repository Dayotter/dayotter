import { describe, expect, it } from "vitest";
import { type CalcomExport, mapCalcomExport, mapEventType, mapLocation } from "./calcom";

describe("mapLocation", () => {
  it("maps Cal.com integration location types to DayOtter types", () => {
    expect(mapLocation({ type: "integrations:google:meet" }).location).toBe("google_meet");
    expect(mapLocation({ type: "integrations:office365_video" }).location).toBe("ms_teams");
    expect(mapLocation({ type: "integrations:zoom", link: "https://zoom.us/j/1" })).toEqual({
      location: "zoom",
      locationDetail: "https://zoom.us/j/1",
    });
    expect(mapLocation({ type: "integrations:daily" }).location).toBe("jitsi");
    expect(mapLocation({ type: "inPerson", address: "12 Main St" })).toEqual({
      location: "in_person",
      locationDetail: "12 Main St",
    });
    expect(mapLocation({ type: "phone", hostPhoneNumber: "+1 555" })).toEqual({
      location: "phone",
      locationDetail: "+1 555",
    });
    expect(mapLocation({ type: "link", link: "https://meet.example" })).toEqual({
      location: "custom",
      locationDetail: "https://meet.example",
    });
  });

  it("falls back to google_meet for unknown/empty types", () => {
    expect(mapLocation({ type: "integrations:unknown-vendor" }).location).toBe("google_meet");
    expect(mapLocation(undefined).location).toBe("google_meet");
  });
});

describe("mapEventType", () => {
  it("maps core fields and slugifies the title when no slug", () => {
    const m = mapEventType({
      title: "Intro Call!!",
      length: 45,
      description: "  chat  ",
      hidden: true,
      requiresConfirmation: true,
      minimumBookingNotice: 120,
      locations: [{ type: "integrations:zoom", link: "https://z" }],
    });
    expect(m).toMatchObject({
      title: "Intro Call!!",
      slug: "intro-call",
      durationMinutes: 45,
      description: "chat",
      location: "zoom",
      locationDetail: "https://z",
      requiresConfirmation: true,
      minimumNoticeMinutes: 120,
      isPrivate: true,
    });
  });

  it("defaults duration/notice and drops detail for detail-less locations", () => {
    const m = mapEventType({ title: "X", locations: [{ type: "integrations:google:meet" }] });
    expect(m?.durationMinutes).toBe(30);
    expect(m?.minimumNoticeMinutes).toBe(60);
    expect(m?.locationDetail).toBeNull();
    expect(m?.isPrivate).toBe(false);
  });

  it("returns null for a titleless entry", () => {
    expect(mapEventType({ title: "  ", length: 30 })).toBeNull();
  });

  it("clamps out-of-range duration", () => {
    expect(mapEventType({ title: "A", length: 100000 })?.durationMinutes).toBe(480);
    expect(mapEventType({ title: "B", length: 1 })?.durationMinutes).toBe(5);
  });
});

describe("mapCalcomExport", () => {
  it("maps a list and drops malformed entries", () => {
    const data: CalcomExport = {
      event_types: [
        { title: "Good", length: 30 },
        { title: "", length: 30 }, // dropped
        { title: "Also good", length: 60, locations: [{ type: "phone" }] },
      ],
    };
    const out = mapCalcomExport(data);
    expect(out).toHaveLength(2);
    expect(out.map((e) => e.title)).toEqual(["Good", "Also good"]);
  });

  it("handles empty/absent event_types", () => {
    expect(mapCalcomExport({})).toEqual([]);
    expect(mapCalcomExport({ event_types: [] })).toEqual([]);
  });
});
