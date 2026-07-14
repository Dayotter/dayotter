import { logger } from "@dayotter/core";
import { and, desc, eq, getDb, gt, schema } from "@dayotter/db";
import { EXTRACTORS } from "./extractors";
import type { MemoryFact } from "./types";

export type { MemoryExtractor, MemoryFact } from "./types";
export { EXTRACTORS } from "./extractors";

/** How long a derived memory stays fresh before we re-derive it. */
const TTL_MS = 24 * 60 * 60 * 1000;
/** Only surface facts we're reasonably sure of. */
const MIN_CONFIDENCE = 0.5;

export interface MemoryEntry {
  kind: string;
  key: string;
  value: unknown;
  label: string;
  confidence: number;
  updatedAt: Date;
}

/** Read a user's current memory (highest-confidence first). */
export async function recallMemory(userId: string): Promise<MemoryEntry[]> {
  const rows = await getDb().query.otterMemory.findMany({
    where: and(
      eq(schema.otterMemory.userId, userId),
      gt(schema.otterMemory.confidence, MIN_CONFIDENCE - 0.001),
    ),
    orderBy: desc(schema.otterMemory.confidence),
  });
  return rows.map((r) => ({
    kind: r.kind,
    key: r.memoryKey,
    value: r.value,
    label: r.label,
    confidence: r.confidence,
    updatedAt: r.updatedAt,
  }));
}

/** Compact block for Otter's prompt. Empty string when there's nothing yet. */
export function summarizeMemory(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.label}`).join("\n");
  return `What you've learned about this user (use it to make sharper, more personalised proposals - never state it back verbatim):\n${lines}`;
}

/** Persist one derived/stated fact (upsert on user+key). */
async function upsertFact(userId: string, fact: MemoryFact): Promise<void> {
  const set = {
    kind: fact.kind,
    value: fact.value,
    label: fact.label,
    confidence: fact.confidence,
    source: fact.source ?? "derived",
    updatedAt: new Date(),
  };
  await getDb()
    .insert(schema.otterMemory)
    .values({ userId, memoryKey: fact.key, ...set })
    .onConflictDoUpdate({
      target: [schema.otterMemory.userId, schema.otterMemory.memoryKey],
      set,
    });
}

/** Record a user-stated preference directly (source = "user"). */
export async function rememberUserFact(
  userId: string,
  fact: Omit<MemoryFact, "source">,
): Promise<void> {
  await upsertFact(userId, { ...fact, source: "user" });
}

/** Re-derive every extractor's fact for a user and upsert the results. */
export async function refreshMemory(userId: string): Promise<number> {
  let written = 0;
  for (const extractor of EXTRACTORS) {
    try {
      const fact = await extractor.extract(userId);
      if (fact) {
        await upsertFact(userId, fact);
        written += 1;
      }
    } catch (err) {
      logger.error("memory extractor failed", {
        event: "memory_extractor_failed",
        key: extractor.key,
        userId,
        err,
      });
    }
  }
  return written;
}

/**
 * Refresh a user's memory if it's stale (or never computed), then return it.
 * Called on the Otter path so memory self-maintains for active users without a
 * dedicated job. The staleness check is a single indexed read.
 */
export async function recallFreshMemory(userId: string): Promise<MemoryEntry[]> {
  const newest = await getDb().query.otterMemory.findFirst({
    where: eq(schema.otterMemory.userId, userId),
    orderBy: desc(schema.otterMemory.updatedAt),
    columns: { updatedAt: true },
  });
  const stale = !newest || Date.now() - newest.updatedAt.getTime() > TTL_MS;
  if (stale) await refreshMemory(userId);
  return recallMemory(userId);
}
