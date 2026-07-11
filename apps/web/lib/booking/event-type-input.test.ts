import { describe, expect, it } from "vitest";
import { eventTypeInputSchema } from "./event-type-input";

const valid = {
  title: "Intro Call",
  slug: "intro-call",
  durationMinutes: 30,
  location: "google_meet" as const,
};

describe("eventTypeInputSchema", () => {
  it("accepts a minimal valid event type and applies defaults", () => {
    const r = eventTypeInputSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.minimumNoticeMinutes).toBe(60);
      expect(r.data.bookingWindowDays).toBe(60);
      expect(r.data.bufferBeforeMinutes).toBe(0);
      expect(r.data.questions).toEqual([]);
    }
  });

  it("rejects an invalid slug (uppercase / spaces / underscores)", () => {
    expect(eventTypeInputSchema.safeParse({ ...valid, slug: "Intro Call" }).success).toBe(false);
    expect(eventTypeInputSchema.safeParse({ ...valid, slug: "intro_call" }).success).toBe(false);
    expect(eventTypeInputSchema.safeParse({ ...valid, slug: "intro-call-2" }).success).toBe(true);
  });

  it("requires locationDetail for zoom/phone/in_person/custom", () => {
    expect(eventTypeInputSchema.safeParse({ ...valid, location: "zoom" }).success).toBe(false);
    expect(
      eventTypeInputSchema.safeParse({ ...valid, location: "zoom", locationDetail: "   " }).success,
    ).toBe(false);
    expect(
      eventTypeInputSchema.safeParse({ ...valid, location: "zoom", locationDetail: "https://z" })
        .success,
    ).toBe(true);
  });

  it("does not require detail for auto-conference locations", () => {
    expect(eventTypeInputSchema.safeParse({ ...valid, location: "ms_teams" }).success).toBe(true);
  });

  it("enforces numeric bounds", () => {
    expect(eventTypeInputSchema.safeParse({ ...valid, durationMinutes: 4 }).success).toBe(false);
    expect(eventTypeInputSchema.safeParse({ ...valid, durationMinutes: 481 }).success).toBe(false);
    expect(eventTypeInputSchema.safeParse({ ...valid, bookingWindowDays: 0 }).success).toBe(false);
  });

  it("validates nested booking questions", () => {
    const withQ = {
      ...valid,
      questions: [{ id: "q1", label: "Topic?", type: "text", required: true }],
    };
    expect(eventTypeInputSchema.safeParse(withQ).success).toBe(true);
    const badType = {
      ...valid,
      questions: [{ id: "q1", label: "x", type: "nope", required: true }],
    };
    expect(eventTypeInputSchema.safeParse(badType).success).toBe(false);
  });
});
