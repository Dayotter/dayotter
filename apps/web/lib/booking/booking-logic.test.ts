import { describe, expect, it } from "vitest";
import { BookingError, mapInsertError, validateResponses } from "./booking-logic";

const q = (id: string, type: string, required: boolean) => ({
  id,
  label: `Q ${id}`,
  type,
  required,
});

describe("validateResponses", () => {
  it("passes when there are no questions", () => {
    expect(() => validateResponses([], {})).not.toThrow();
    expect(() => validateResponses(null, null)).not.toThrow();
  });

  it("ignores optional questions even when unanswered", () => {
    expect(() => validateResponses([q("1", "text", false)], {})).not.toThrow();
  });

  it("throws a 400 naming the first unanswered required question", () => {
    try {
      validateResponses([q("1", "text", true)], {});
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BookingError);
      expect((e as BookingError).status).toBe(400);
      expect((e as BookingError).message).toBe("Please answer: Q 1");
    }
  });

  it("treats whitespace-only text answers as unanswered", () => {
    expect(() => validateResponses([q("1", "text", true)], { "1": "   " })).toThrow(BookingError);
  });

  it("requires a required checkbox to be exactly true", () => {
    expect(() => validateResponses([q("1", "checkbox", true)], { "1": false })).toThrow(
      BookingError,
    );
    expect(() => validateResponses([q("1", "checkbox", true)], { "1": "true" })).toThrow(
      BookingError,
    );
    expect(() => validateResponses([q("1", "checkbox", true)], { "1": true })).not.toThrow();
  });

  it("accepts a non-empty text answer", () => {
    expect(() => validateResponses([q("1", "text", true)], { "1": "hello" })).not.toThrow();
  });
});

describe("mapInsertError", () => {
  it("maps a Postgres unique violation (23505) to a 409 BookingError", () => {
    try {
      mapInsertError({ code: "23505" });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BookingError);
      expect((e as BookingError).status).toBe(409);
    }
  });

  it("passes a BookingError through unchanged", () => {
    const original = new BookingError("nope", 400);
    expect(() => mapInsertError(original)).toThrow(original);
  });

  it("rethrows unknown errors as-is", () => {
    const other = new Error("boom");
    expect(() => mapInsertError(other)).toThrow(other);
  });
});
