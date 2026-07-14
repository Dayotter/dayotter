# Otter - the AI inside DayOtter

Otter is DayOtter's AI executive assistant. This document covers the philosophy,
the architecture, how the AI stays open, and - most importantly - **where it's
going**: the advancements and improvements we want the community to help build.

> The whole AI subsystem is **AGPLv3 and self-hostable**. Bring your own
> `ANTHROPIC_API_KEY` (or point the model layer at any provider) and run every
> feature below on your own infrastructure, for free. Cal.com closed its source
> "because of AI"; we went the other way.

---

## Philosophy

1. **Confirm-first, always.** Otter *proposes*; a human confirms before anything
   is created, moved, cancelled, or sent - on every surface (web, chat, mobile,
   SMS/WhatsApp, voice, proactive nudges). This is the invariant. No silent
   auto-scheduling (the thing people fear about Motion).
2. **Grounded, not hallucinated.** Otter answers from the user's real
   availability, bookings, and knowledge base. It's told to defer ("I'll have the
   host follow up") rather than invent hours, prices, or slots.
3. **The assistant is the product, not an add-on.** Talking to Otter is a primary
   way to use DayOtter - at no per-minute metered cost (unlike Cal.ai's voice).
4. **One brain, every surface.** The command bar, mobile, and SMS share a single
   interpret core, so behaviour is identical everywhere.

## Architecture

```
                       ┌───────────────────────────────────────────┐
  surfaces             │  web command bar · chat · mobile · SMS ·   │
                       │  WhatsApp · voice · proactive suggestions   │
                       └───────────────┬───────────────────────────┘
                                       │
        interpret.ts  ◀── memory recall ── retrieval (RAG-lite) ──▶ context
        (the shared brain)             │
                                       ▼
        parse (single-shot)  ·  agent (availability loop)  ·  chat (streaming)
                                       │
                            ┌──────────┴──────────┐
                            ▼                     ▼
                     propose a draft        tool registry
                     (confirm card)         (read inline / write→confirm)
                                       │
                              user taps Confirm
                                       ▼
                          execute (reuses the app's own write paths)
```

### The LLM layer - `lib/ai/llm.ts`
The single Anthropic choke point. `aiEnabled` is just "is a key present." Model
tiers live in one place - `deep: claude-opus-4-8`, `fast: claude-haiku-4-5` -
swap models without touching features. `extract()` is the shared structured-output
primitive (forced tool-use → Zod-validated object, with a chain-of-thought
field), plus prompt caching and streaming. **No feature instantiates its own
client**, which is what makes the model layer swappable (including to a
self-hosted or alternative provider).

### The interpret core - `lib/ai/interpret.ts`
`interpretOtterCommand(userId, text)` is the shared brain for every non-chat
surface. It recalls memory + retrieves relevant bookings in parallel, then routes:
availability-dependent requests go through the agentic loop; everything else
through the fast single-shot parser. Returns a confirm-first draft. Never writes.

### The tool registry - `lib/ai/tools/`
A declarative catalog where each tool is tagged `read` / `write` / `destructive`
with a confirm level. **Reads run inline; writes surface a confirm card;
destructive actions get a danger confirm.** Execution reuses the app's own
validated DB writes - the assistant can never do anything the app itself
couldn't. To give Otter a new capability, add a tool.

### Memory - `lib/ai/memory/`  ([module README](../apps/web/lib/ai/memory/README.md))
Long-term, per-user patterns (typical duration, frequent contacts, active hours,
busiest weekday, meeting load) derived from real history and injected into the
prompt so proposals get personal. Self-refreshing, honest (only claims clear
patterns). **Extension point:** add a `MemoryExtractor`.

### Proactive - `lib/ai/proactive.ts`
Otter noticing things unprompted - protect an open focus window, turn on
running-late alerts when you have back-to-backs, start a morning briefing - each
confirm-first on the dashboard.

### Voice receptionist - `lib/voice/`  ([module README](../apps/web/lib/voice/README.md))
A 24/7 phone line: greets, answers from the host's knowledge, and texts a booking
link (never books blind). Pluggable knowledge sources; enhanced phone speech
recognition.

### Where your time goes - `lib/analytics/time-allocation/`  ([README](../apps/web/lib/analytics/time-allocation/README.md))
A pluggable metric registry over your bookings + focus time. Add a `TimeMetric`.

## How the AI stays open

- **Bring your own key / model.** Set `ANTHROPIC_API_KEY` and everything works.
  Because all AI flows through `llm.ts`, pointing at a different provider (or a
  self-hosted model) is a one-file change.
- **No data leaves without use.** If you never use Otter, nothing is sent to a
  model. When you do, only the relevant scheduling context goes.
- **The commercial part is convenience, not capability.** DayOtter Cloud's
  "Managed AI" (in `ee/`) just means *we* supply the key so you don't have to -
  the AI *code* is fully open. See [`ENTERPRISE.md`](./ENTERPRISE.md).

---

## Roadmap - advancements we want to build

Otter is early. These are the improvements that would most deepen it - great
places to contribute. Grouped by ambition.

### Near-term (sharpen what's here)
- **Memory depth** - more extractors (preferred buffers, no-meeting days,
  reschedule habits, video-vs-in-person preference); LLM-summarised freeform
  notes from conversations as low-confidence `inferred` facts.
- **Proactive breadth** - buffer suggestions for back-to-backs, "your Thursday is
  overloaded - move something?", stale-holds cleanup, follow-up nudges.
- **Voice quality** - capture the caller's name/intent, confirm-back before
  texting, multi-tenant number→host mapping, call transcripts + summaries.
- **Grounding** - a real knowledge-base store (custom FAQ, hours, pricing) the
  voice + chat assistants answer from, with citations.
- **Time analytics** - external-vs-internal split (by email domain), longest focus
  streak, recurring load, "reclaimed time" Otter protected.

### Mid-term (new capability)
- **Real Scribe** - live Zoom/Meet transcription → summary + extracted action
  items, wired into post-meeting workflows (today it's a recap nudge).
- **Negotiation over SMS/voice** - actually book a specific slot conversationally
  (propose times, confirm), not just hand over a link.
- **Team-aware Otter** - "find 30 min with the design pod next week" resolving
  across members' real availability and round-robin weights.
- **Smart routing by intent** - the routing form powered by Otter understanding
  the enquiry, not just field rules.

### Longer-term (the vision)
- **A genuinely proactive EA** - Otter plans the week with you: proposes a draft
  calendar each Monday (focus blocks, batched meetings, protected mornings),
  confirm-first, learning from what you accept.
- **Multi-model + local** - first-class support for self-hosted/open models so a
  fully offline, private Otter is possible.
- **Evaluation harness** - a test suite of scheduling scenarios to measure
  accuracy and prevent regressions as prompts and models change. (High-value,
  low-glamour - a great contribution.)
- **Agentic tool growth** - as the tool registry expands, Otter can handle more of
  the calendar end-to-end, always confirm-first.

## Contributing to Otter

The AI subsystem is deliberately modular so improvements are small, well-scoped
PRs:

| Want to… | Do this |
|---|---|
| Teach Otter a new fact | add a `MemoryExtractor` to `EXTRACTORS` |
| Add a proactive nudge | add a `ProactiveSuggestion` type + action |
| Add a "where your time goes" insight | add a `TimeMetric` to `METRICS` |
| Give the voice bot new knowledge | add a `KnowledgeSource` |
| Give Otter a new capability | add a tool to the registry (`kind` + confirm level) |
| Support another model/provider | it's one place - `llm.ts` |

See [`CONTRIBUTING.md`](../CONTRIBUTING.md) and each module's README. Ideas and
prototypes welcome in [Discussions](../../discussions).
