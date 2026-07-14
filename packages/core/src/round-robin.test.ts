import { describe, expect, it } from "vitest";
import { type RoundRobinCandidate, roundRobinPick } from "./round-robin";

const c = (userId: string, priority: number, currentLoad: number): RoundRobinCandidate => ({
  userId,
  priority,
  currentLoad,
});

describe("roundRobinPick", () => {
  it("returns null for empty or all-ineligible input", () => {
    expect(roundRobinPick([])).toBeNull();
    expect(roundRobinPick([c("a", 0, 0), c("b", -1, 0)])).toBeNull();
  });

  it("excludes candidates with priority <= 0", () => {
    const picked = roundRobinPick([c("a", 0, 0), c("b", 1, 5)]);
    expect(picked?.userId).toBe("b"); // 'a' ineligible despite lower load
  });

  it("picks the lowest load/priority (fair share), not the lowest raw load", () => {
    // a: load 3 / prio 1 = 3.0 ; b: load 4 / prio 2 = 2.0 -> b wins despite higher raw load.
    expect(roundRobinPick([c("a", 1, 3), c("b", 2, 4)])?.userId).toBe("b");
  });

  it("weights by priority - a higher-priority host absorbs more load before losing", () => {
    // hi: prio 3, lo: prio 1. Simulate 8 assignments; priority-3 gets the majority.
    let hiCount = 0;
    let loCount = 0;
    let hiLoad = 0;
    let loLoad = 0;
    for (let i = 0; i < 8; i++) {
      const picked = roundRobinPick([c("hi", 3, hiLoad), c("lo", 1, loLoad)]);
      if (picked?.userId === "hi") {
        hiCount++;
        hiLoad++;
      } else {
        loCount++;
        loLoad++;
      }
    }
    expect(hiCount).toBeGreaterThan(loCount);
  });

  it("breaks ties deterministically by userId ascending", () => {
    expect(roundRobinPick([c("b", 1, 2), c("a", 1, 2)])?.userId).toBe("a");
    expect(roundRobinPick([c("a", 1, 2), c("b", 1, 2)])?.userId).toBe("a");
  });

  it("handles all-zero load without NaN", () => {
    const picked = roundRobinPick([c("b", 1, 0), c("a", 2, 0)]);
    expect(picked?.userId).toBe("a"); // 0/2 == 0/1 == 0 -> tie -> lowest userId
  });
});
