import { describe, expect, it } from "vitest";
import {
  type CalendlyEventType,
  hexToColorToken,
  mapEventType,
  mapLocation,
  mapQuestions,
  mapSchedule,
  mapScheduleRules,
  shouldImportEventType,
  toEventSlug,
} from "./calendly";

describe("toEventSlug", () => {
  it("slugifies names to our lowercase-dash format", () => {
    expect(toEventSlug("15 Minute Meeting")).toBe("15-minute-meeting");
    expect(toEventSlug("Coffee ☕ Chat!")).toBe("coffee-chat");
  });
  it("never returns empty and truncates to 60", () => {
    expect(toEventSlug("")).toBe("event");
    expect(toEventSlug("!!!")).toBe("event");
    expect(toEventSlug("a".repeat(80)).length).toBe(60);
  });
  it("trims trailing dashes left by truncation", () => {
    expect(toEventSlug("word ".repeat(20)).endsWith("-")).toBe(false);
  });
});

describe("hexToColorToken", () => {
  it("buckets hues to tokens", () => {
    expect(hexToColorToken("#ff2d2d")).toBe("coral"); // red
    expect(hexToColorToken("#ffd400")).toBe("amber"); // yellow
    expect(hexToColorToken("#12c98a")).toBe("mint"); // green
    expect(hexToColorToken("#2d7dff")).toBe("sky"); // blue
    expect(hexToColorToken("#8a2dff")).toBe("violet"); // purple
  });
  it("returns null for grey / invalid / missing", () => {
    expect(hexToColorToken("#808080")).toBeNull();
    expect(hexToColorToken("not-a-hex")).toBeNull();
    expect(hexToColorToken(null)).toBeNull();
  });
});

describe("mapLocation", () => {
  it("maps conference kinds to our auto-conference types", () => {
    expect(mapLocation([{ kind: "google_conference" }]).location).toBe("google_meet");
    expect(mapLocation([{ kind: "microsoft_teams_conference" }]).location).toBe("ms_teams");
  });
  it("maps zoom, carrying a join url when present", () => {
    const z = mapLocation([{ kind: "zoom_conference", join_url: "https://zoom.us/j/1" }]);
    expect(z.location).toBe("zoom");
    expect(z.locationDetail).toBe("https://zoom.us/j/1");
  });
  it("maps physical to in_person with the address", () => {
    const p = mapLocation([{ kind: "physical", location: "123 Main St" }]);
    expect(p).toEqual({ location: "in_person", locationDetail: "123 Main St" });
  });
  it("gives detail-requiring types a non-empty fallback detail", () => {
    expect(mapLocation([{ kind: "zoom_conference" }]).locationDetail).toBeTruthy();
    expect(mapLocation([{ kind: "physical" }]).locationDetail).toBeTruthy();
  });
  it("defaults to google_meet when there is no location", () => {
    expect(mapLocation(null).location).toBe("google_meet");
    expect(mapLocation([]).location).toBe("google_meet");
    expect(mapLocation([{ kind: "something_new" }]).location).toBe("google_meet");
  });
});

describe("mapQuestions", () => {
  it("maps types and keeps select options, skipping disabled", () => {
    const qs = mapQuestions([
      { name: "Your role", type: "string", required: true },
      { name: "Notes", type: "text", required: false },
      { name: "Team", type: "single_select", answer_choices: ["Eng", "Sales"] },
      { name: "Hidden", type: "string", enabled: false },
    ]);
    expect(qs).toHaveLength(3);
    expect(qs[0]).toMatchObject({ label: "Your role", type: "text", required: true, id: "q1" });
    expect(qs[1]).toMatchObject({ type: "textarea" });
    expect(qs[2]).toMatchObject({ type: "select", options: ["Eng", "Sales"] });
  });
  it("caps at 20 questions", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ name: `Q${i}`, type: "string" }));
    expect(mapQuestions(many)).toHaveLength(20);
  });
});

describe("mapScheduleRules", () => {
  it("expands wday rules (incl. multiple intervals) and maps day indices", () => {
    const rules = mapScheduleRules([
      {
        type: "wday",
        wday: "monday",
        intervals: [
          { from: "09:00", to: "12:00" },
          { from: "13:00", to: "17:00" },
        ],
      },
      { type: "wday", wday: "sunday", intervals: [] }, // day off
      { type: "date", date: "2026-12-25", intervals: [{ from: "10:00", to: "11:00" }] }, // skipped
    ]);
    expect(rules).toEqual([
      { dayOfWeek: 1, startTime: "09:00:00", endTime: "12:00:00" },
      { dayOfWeek: 1, startTime: "13:00:00", endTime: "17:00:00" },
    ]);
  });
});

describe("mapSchedule", () => {
  it("carries name/timezone/default and its weekly rules", () => {
    const s = mapSchedule({
      uri: "u",
      name: "Working hours",
      default: true,
      timezone: "America/New_York",
      rules: [{ type: "wday", wday: "friday", intervals: [{ from: "09:00", to: "17:00" }] }],
    });
    expect(s).toMatchObject({
      name: "Working hours",
      timezone: "America/New_York",
      isDefault: true,
    });
    expect(s.rules).toEqual([{ dayOfWeek: 5, startTime: "09:00:00", endTime: "17:00:00" }]);
  });
});

describe("shouldImportEventType / mapEventType", () => {
  const base: CalendlyEventType = {
    uri: "https://api.calendly.com/event_types/A",
    name: "Intro Call",
    slug: "intro-call",
    duration: 30,
    active: true,
    color: "#2d7dff",
    type: "StandardEventType",
    secret: false,
  };

  it("skips ad-hoc and deleted event types", () => {
    expect(shouldImportEventType(base)).toBe(true);
    expect(shouldImportEventType({ ...base, type: "AdhocEventType" })).toBe(false);
    expect(shouldImportEventType({ ...base, deleted_at: "2026-01-01" })).toBe(false);
  });

  it("maps the core fields", () => {
    const m = mapEventType(base);
    expect(m).toMatchObject({
      title: "Intro Call",
      slug: "intro-call",
      durationMinutes: 30,
      location: "google_meet",
      color: "sky",
      isActive: true,
      isPrivate: false,
    });
  });

  it("clamps out-of-range durations and flags secret events private", () => {
    expect(mapEventType({ ...base, duration: 2 }).durationMinutes).toBe(5);
    expect(mapEventType({ ...base, duration: 900 }).durationMinutes).toBe(480);
    expect(mapEventType({ ...base, secret: true }).isPrivate).toBe(true);
  });
});
