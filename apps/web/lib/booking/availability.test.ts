import { describe, expect, it } from "vitest";
import { combineHostSlots } from "./availability";

const slot = (iso: string) => ({ start: new Date(iso), end: new Date(iso) });
const starts = (arr: { start: Date }[]) => arr.map((s) => s.start.toISOString());

const A = slot("2026-07-08T09:00:00Z");
const B = slot("2026-07-08T09:30:00Z");
const C = slot("2026-07-08T10:00:00Z");

describe("combineHostSlots", () => {
  it("returns [] for no hosts", () => {
    expect(combineHostSlots([], "round_robin")).toEqual([]);
  });

  it("returns the single host's slots for individual/one-host events", () => {
    expect(starts(combineHostSlots([[A, B]], "individual"))).toEqual(starts([A, B]));
  });

  it("collective → only slots common to every host (intersection)", () => {
    const combined = combineHostSlots(
      [
        [A, B, C],
        [B, C],
      ],
      "collective",
    );
    expect(starts(combined)).toEqual(starts([B, C])); // A dropped (host 2 not free)
  });

  it("round_robin → union of all hosts, deduped by start and sorted", () => {
    const combined = combineHostSlots(
      [
        [C, A], // unsorted on purpose
        [A, B],
      ],
      "round_robin",
    );
    expect(starts(combined)).toEqual(starts([A, B, C])); // deduped A, sorted ascending
  });
});
