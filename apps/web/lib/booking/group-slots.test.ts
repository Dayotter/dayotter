import type { Slot } from "@dayotter/core";
import { describe, expect, it } from "vitest";
import { filterOpenGroupSlots } from "./availability";

const slot = (iso: string): Slot => ({ start: new Date(iso), end: new Date(iso) }) as Slot;

describe("filterOpenGroupSlots", () => {
  const a = slot("2026-07-15T10:00:00Z");
  const b = slot("2026-07-15T11:00:00Z");
  const c = slot("2026-07-15T12:00:00Z");

  it("hides only slots at/over capacity", () => {
    const counts = new Map<number, number>([
      [a.start.getTime(), 5], // full
      [b.start.getTime(), 2], // room left
      // c: no bookings yet
    ]);
    const open = filterOpenGroupSlots([a, b, c], counts, 5);
    expect(open.map((s) => s.start.toISOString())).toEqual([
      "2026-07-15T11:00:00.000Z",
      "2026-07-15T12:00:00.000Z",
    ]);
  });

  it("treats an unbooked slot as fully open", () => {
    expect(filterOpenGroupSlots([a], new Map(), 3)).toHaveLength(1);
  });

  it("hides a slot exactly at capacity", () => {
    expect(filterOpenGroupSlots([a], new Map([[a.start.getTime(), 3]]), 3)).toHaveLength(0);
  });
});
