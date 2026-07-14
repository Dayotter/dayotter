# Otter Memory

Long-term memory that makes Otter smarter about a user over time. It derives
**patterns** from behaviour (how long meetings run, who they meet, when they're
busy) and stores **stated preferences**, then injects a compact summary into
Otter's prompt so every proposal is personalised.

## Shape

```
otter_memory (packages/db/src/schema/memory.ts)
  one row per (userId, memoryKey), upserted on refresh
  label  → the human line fed into the prompt
  value  → structured data behind the label
  kind / confidence / source
```

## Flow

```
extractors[]  --refreshMemory(userId)-->  otter_memory  --recallMemory-->  summarizeMemory --> Otter prompt
```

- `refreshMemory(userId)` runs every extractor and upserts the facts it returns.
- `recallFreshMemory(userId)` refreshes if stale (>24h) then reads - this is what
  the Otter path (`lib/ai/interpret.ts`) calls, so memory self-maintains for
  active users with no dedicated job.
- `summarizeMemory(entries)` renders the block for the prompt.
- `rememberUserFact(userId, fact)` stores an explicit user-stated preference
  (source `"user"`), which outranks derived facts of the same key.

## Extending - add a fact Otter can learn

Add a `MemoryExtractor` to `EXTRACTORS` in `extractors.ts`:

```ts
{
  key: "prefers_video", // stable, unique per user
  async extract(userId) {
    // ...look at the user's data...
    if (!enoughSignal) return null; // honest: no fact without evidence
    return {
      kind: "preference",
      key: "prefers_video",
      value: { ratio: 0.9 },
      label: "Prefers video calls over in-person",
      confidence: 0.8,
    };
  },
}
```

That's the only change needed - refresh, recall, and the prompt pick it up
automatically.

## Ideas for future extractors
- `preferred_buffer` - typical gap they leave between meetings
- `prefers_video` / `prefers_location`
- `no_meeting_days` - weekdays they keep clear
- `reschedule_habits` - how often / how far ahead they move things
- LLM-summarised freeform notes from Otter conversations (a `source: "inferred"` fact)

## Guardrails
- Extractors return `null` without enough signal - memory only holds facts we can
  stand behind.
- Only facts above `MIN_CONFIDENCE` are recalled into the prompt.
- The prompt line tells Otter to *use* memory, not recite it back.
