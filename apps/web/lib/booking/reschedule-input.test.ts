import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { rescheduleInput } from "./reschedule-input";

describe("rescheduleInput", () => {
  it("accepts the offset-bearing ISO string the Otter chat sends", () => {
    // Exactly how components/ai-assistant.tsx confirmReschedule() builds it.
    const start = DateTime.fromFormat("2026-10-30T13:00", "yyyy-MM-dd'T'HH:mm", {
      zone: "America/New_York",
    }).toISO();
    expect(start).toMatch(/-04:00$/);
    expect(rescheduleInput.safeParse({ start }).success).toBe(true);
  });

  it("accepts the `Z` form (mobile + booking page send toISOString())", () => {
    const parsed = rescheduleInput.safeParse({
      start: "2026-10-30T17:00:00.000Z",
      reason: "Conflict",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects garbage and missing starts", () => {
    for (const start of ["tomorrow at 1pm", "2026-10-30", "2026-10-30T13:00", "", 123, null]) {
      expect(rescheduleInput.safeParse({ start }).success).toBe(false);
    }
    expect(rescheduleInput.safeParse({}).success).toBe(false);
  });

  it("rejects an over-long reason", () => {
    const parsed = rescheduleInput.safeParse({
      start: "2026-10-30T17:00:00.000Z",
      reason: "x".repeat(501),
    });
    expect(parsed.success).toBe(false);
  });
});
