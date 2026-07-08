export interface RoundRobinCandidate {
  userId: string;
  /** Higher weight => selected more often. */
  priority: number;
  /** Count of bookings already assigned in the balancing window. */
  currentLoad: number;
}

/**
 * Pick the next host for a round-robin event type. Chooses the candidate whose
 * load is furthest below its fair share (load / priority), which yields
 * weighted, load-balanced distribution. Deterministic given the inputs; ties
 * break by userId for stability.
 */
export function roundRobinPick(candidates: RoundRobinCandidate[]): RoundRobinCandidate | null {
  const eligible = candidates.filter((c) => c.priority > 0);
  if (eligible.length === 0) return null;

  return eligible.slice().sort((a, b) => {
    const aScore = a.currentLoad / a.priority;
    const bScore = b.currentLoad / b.priority;
    if (aScore !== bScore) return aScore - bScore;
    return a.userId < b.userId ? -1 : 1;
  })[0]!;
}
