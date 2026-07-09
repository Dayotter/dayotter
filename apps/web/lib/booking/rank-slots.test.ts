import { describe, expect, it } from "vitest";
import { type Interval, recommendedSlots, scoreSlot } from "./rank-slots";

const iv = (startISO: string, mins = 30): Interval => ({
  start: new Date(startISO),
  end: new Date(new Date(startISO).getTime() + mins * 60_000),
});

// A fixed "now" well before the slots so earliness terms are stable.
const NOW = new Date("2026-07-06T00:00:00Z");
const opts = { timezone: "UTC", now: NOW };

describe("scoreSlot", () => {
  it("scores a slot back-to-back with a commitment above an isolated one", () => {
    const commitment = iv("2026-07-08T10:00:00Z", 60); // ends 11:00
    const adjacent = iv("2026-07-08T11:00:00Z"); // starts exactly at commitment end
    const isolated = iv("2026-07-08T15:00:00Z"); // far from any commitment
    expect(scoreSlot(adjacent, [commitment], opts)).toBeGreaterThan(
      scoreSlot(isolated, [commitment], opts),
    );
  });

  it("treats a slot ending right before a commitment as adjacent too", () => {
    const commitment = iv("2026-07-08T14:00:00Z", 60);
    const before = iv("2026-07-08T13:30:00Z"); // ends 14:00 = commitment start
    expect(scoreSlot(before, [commitment], opts)).toBeGreaterThanOrEqual(100);
  });

  it("respects the host's gap when judging adjacency", () => {
    const commitment = iv("2026-07-08T10:00:00Z", 60); // ends 11:00
    const afterGap = iv("2026-07-08T11:15:00Z"); // 15 min after → adjacent within a 15-min gap
    expect(scoreSlot(afterGap, [commitment], { ...opts, gapMinutes: 15 })).toBeGreaterThanOrEqual(
      100,
    );
  });

  it("prefers the preferred hour when no commitments exist", () => {
    const morning = iv("2026-07-08T10:30:00Z"); // near default preferred 10.5
    const evening = iv("2026-07-08T18:30:00Z");
    expect(scoreSlot(morning, [], opts)).toBeGreaterThan(scoreSlot(evening, [], opts));
  });
});

describe("recommendedSlots", () => {
  it("returns [] with no slots", () => {
    expect(recommendedSlots([], [], opts)).toEqual([]);
  });

  it("spreads recommendations across distinct days, chronologically", () => {
    const slots = [
      iv("2026-07-08T10:00:00Z"),
      iv("2026-07-08T10:30:00Z"),
      iv("2026-07-09T10:00:00Z"),
      iv("2026-07-10T10:00:00Z"),
    ];
    const rec = recommendedSlots(slots, [], { ...opts, max: 3 });
    expect(rec).toHaveLength(3);
    const days = rec.map((s) => s.start.toISOString().slice(0, 10));
    expect(new Set(days).size).toBe(3); // one per day
    // chronological
    expect(rec.map((s) => s.start.getTime())).toEqual(
      [...rec.map((s) => s.start.getTime())].sort((a, b) => a - b),
    );
  });

  it("falls back to filling from the same day when distinct days run out", () => {
    const slots = [iv("2026-07-08T10:00:00Z"), iv("2026-07-08T11:00:00Z")];
    const rec = recommendedSlots(slots, [], { ...opts, max: 3 });
    expect(rec).toHaveLength(2);
  });
});
