/** A single thing Otter has learned or been told about a user. */
export interface MemoryFact {
  kind: "pattern" | "preference" | "contact" | "fact";
  /** Stable key, unique per user (upsert target), e.g. "typical_duration". */
  key: string;
  /** Structured data behind the fact (for programmatic use). */
  value: unknown;
  /** One-line human summary injected into Otter's prompt. */
  label: string;
  /** 0..1 — how sure we are. Low-confidence facts can be filtered out. */
  confidence: number;
  source?: "derived" | "user" | "inferred";
}

/**
 * An extractor derives zero or one MemoryFact for a user from their data. This
 * is the extension point: add a new extractor to EXTRACTORS (extractors.ts) and
 * Otter gets a new thing it can learn. Each extractor owns one stable `key`.
 *
 * Return `null` when there isn't enough signal (e.g. a brand-new user) — the
 * refresh simply skips it, so memory only ever holds facts we can stand behind.
 */
export interface MemoryExtractor {
  key: string;
  /** Derive the fact, or null if there isn't enough data yet. */
  extract(userId: string): Promise<MemoryFact | null>;
}
