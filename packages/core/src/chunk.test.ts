import { describe, expect, it } from "vitest";
import { chunk } from "./chunk";

describe("chunk", () => {
  it("splits into consecutive slices of at most size, keeping order", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no slices for an empty list", () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it("keeps every item when the length is an exact multiple", () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const parts = chunk(items, 500);
    expect(parts.map((p) => p.length)).toEqual([500, 500]);
    expect(parts.flat()).toEqual(items);
  });

  it("accepts the smallest valid size, one item per slice", () => {
    expect(chunk([1, 2], 1)).toEqual([[1], [2]]);
  });

  it("rejects a size that would loop forever or drop items", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});
