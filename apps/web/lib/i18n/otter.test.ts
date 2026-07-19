import { describe, expect, it } from "vitest";
import { tOtter } from "./otter";

describe("tOtter", () => {
  it("translates chrome keys per locale", () => {
    expect(tOtter("en", "askOtter")).toBe("Ask Otter");
    expect(tOtter("es", "askOtter")).toBe("Pregunta a Otter");
    expect(tOtter("de", "otterNoticed")).toBe("Otter hat bemerkt");
  });

  it("interpolates variables", () => {
    expect(tOtter("en", "addedEvent", { title: "Focus" })).toBe("Added Focus to your calendar.");
    expect(tOtter("fr", "withAttendees", { names: "Ada" })).toContain("Ada");
  });

  it("falls back to English for an unmapped locale", () => {
    // @ts-expect-error - exercising the runtime fallback path
    expect(tOtter("zz", "confirm")).toBe("Confirm");
  });
});
