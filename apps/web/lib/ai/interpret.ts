import { DateTime } from "luxon";
import { runSchedulingAgent } from "./agent";
import { type BookingContext, type CommandDraft, parseCommand } from "./command-parse";
import { recallFreshMemory, summarizeMemory } from "./memory";
import { retrieveCalendarContext } from "./retrieval";

/**
 * The single Otter "brain" for turning a natural-language scheduling request
 * into a confirm-first draft. Shared by every surface that isn't the streaming
 * chat - the web command bar (/api/ai/command), the mobile Ask bar, and inbound
 * WhatsApp/SMS - so they all interpret identically. The caller renders/executes
 * the draft; this never writes.
 */

export interface OtterTarget {
  uid: string;
  title: string;
  startISO: string;
}

export interface OtterInterpretation {
  draft: CommandDraft;
  timezone: string;
  /** For reschedule/cancel: the resolved existing booking (null if unresolved). */
  target: OtterTarget | null;
  /** For create: the matched event type, when the request named one. */
  matchedEventType: { title: string; slug: string; durationMinutes: number } | null;
}

/**
 * Availability-dependent requests ("find a free slot", "when am I open") go
 * through the read-only agentic loop, which can look up real free slots;
 * everything else uses the faster single-shot parse. Either way it only drafts.
 */
export function needsAvailability(text: string): boolean {
  return /\b(free|available|availability|open(ing)?|slot|sometime|any\s?time|whenever|earliest|soonest|next\s+(free|open|available))\b/i.test(
    text,
  );
}

export async function interpretOtterCommand(
  userId: string,
  text: string,
): Promise<OtterInterpretation> {
  // RAG-lite: retrieve only the bookings relevant to this request. This
  // retrieved list is the source of truth for the model's booking refs. In
  // parallel, recall (and self-refresh) Otter's memory of this user.
  const [ctx, memoryEntries] = await Promise.all([
    retrieveCalendarContext(userId, text),
    recallFreshMemory(userId).catch(() => []),
  ]);
  const tz = ctx.timezone;

  const bookings: BookingContext[] = ctx.bookings.map((b, i) => ({
    ref: i + 1,
    title: b.title,
    whenLocal: DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a"),
    attendees: b.attendees,
  }));

  const args = {
    text,
    timezone: tz,
    now: new Date(),
    bookings,
    eventTypes: ctx.eventTypes,
    memory: summarizeMemory(memoryEntries),
  };
  const draft = needsAvailability(text)
    ? await runSchedulingAgent({ ...args, userId })
    : await parseCommand(args);

  let matchedEventType: OtterInterpretation["matchedEventType"] = null;
  if (draft.intent === "create" && draft.eventTypeSlug) {
    const et = ctx.eventTypes.find((e) => e.slug === draft.eventTypeSlug);
    if (et) matchedEventType = et;
  }

  let target: OtterTarget | null = null;
  if (draft.intent === "reschedule" || draft.intent === "cancel") {
    const b = ctx.bookings[draft.bookingRef - 1];
    if (b) target = { uid: b.uid, title: b.title, startISO: b.startsAt.toISOString() };
  }

  return { draft, timezone: tz, target, matchedEventType };
}
