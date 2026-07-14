# AI Voice Receptionist

A 24/7 phone receptionist. Callers dial a Twilio number; the receptionist greets
them, answers questions grounded in the host's knowledge, and texts a booking
link when they want to make an appointment — confirm-first (it hands over a link,
it never books blind).

## Flow

```
Caller dials Twilio number
        │  Twilio POST /api/webhooks/twilio/voice
        ▼
  resolveVoiceHost(To) ──▶ buildKnowledge(host) ──▶ greet  <Gather speech>
        │                                                     │ caller speaks
        ▼                                                     ▼
  handleVoiceTurn({knowledge, history, speech})  ──▶  { reply, next }
        │
        ├─ listen            → <Say>reply</Say> <Gather> again
        ├─ send_booking_link → text the caller the link, keep listening
        └─ hangup            → <Say>reply</Say> <Hangup>
```

Conversation state (history + knowledge) lives in Redis per `CallSid`.

## Pieces
- `receptionist.ts` — the LLM turn (fast tier for phone latency), grounded on
  knowledge, returns `{ reply, next }`.
- `knowledge.ts` — `KNOWLEDGE_SOURCES[]`: pluggable grounding (services, welcome,
  booking). **Extension point** — add a source (hours, pricing, a custom FAQ
  table) and the receptionist can answer from it.
- `resolver.ts` — maps the called number → host. MVP is single-tenant via
  `VOICE_RECEPTIONIST_HANDLE`; swap for a `voice_numbers` table for multi-tenant.
- `twiml.ts` — `<Gather>` / `<Say>` / `<Hangup>` builders.
- route `app/api/webhooks/twilio/voice` — signature-verified webhook + the
  action switch (`listen` / `send_booking_link` / `hangup`).

## Extending
- **New knowledge:** add a `KnowledgeSource` to `KNOWLEDGE_SOURCES`.
- **New action:** add a value to `VoiceNext`, teach the model when to use it (in
  `systemPrompt` + `inputSchema`), and add a case in the route's action switch
  (e.g. `transfer` → `<Dial>` the host).
- **Multi-tenant:** implement `resolveVoiceHost` against a number→host table.

## Setup (deploy-time — can't be tested without a live call)
1. Buy a Twilio Voice number.
2. Point its **A Call Comes In** webhook at `https://<APP_URL>/api/webhooks/twilio/voice` (HTTP POST).
3. Set `TWILIO_AUTH_TOKEN` (signature), `ANTHROPIC_API_KEY` (the turn), `TWILIO_SMS_FROM` (the link text), and `VOICE_RECEPTIONIST_HANDLE`.

## Guardrails
- Signature-verified, fail-closed (403).
- Grounded: the model answers only from KNOWLEDGE, and is told to defer rather
  than invent.
- Confirm-first: booking is always a texted link the caller chooses from.
- Runaway guard: caps the conversation at `MAX_TURNS`.
