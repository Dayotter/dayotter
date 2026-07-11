import { runSchedulingAgent } from "@/lib/ai/agent";
import { type BookingContext, aiEnabled, parseCommand } from "@/lib/ai/command-parse";
import { retrieveCalendarContext } from "@/lib/ai/retrieval";
import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ text: z.string().min(1).max(500) });

/**
 * Does the request need the host's real availability to answer? If so we run the
 * read-only agentic loop (which can look up free slots) instead of a single-shot
 * parse. Cheap heuristic — the agent still just proposes; the human confirms.
 */
function needsAvailability(text: string): boolean {
  return /\b(free|available|availability|open(ing)?|slot|sometime|any\s?time|whenever|earliest|soonest|next\s+(free|open|available))\b/i.test(
    text,
  );
}

/**
 * Natural-language command → an editable draft (create / reschedule / cancel).
 * Confirm-first: this only interprets against the user's own upcoming bookings;
 * it never writes. The client confirms, then calls the write endpoints.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);
  const gate = await requireFeature(u.id, "ai");
  if (gate) return gate;

  const limited = await enforceRateLimit(request, {
    name: "ai-command",
    limit: 20,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a request", 400);

  // RAG-lite: retrieve only the bookings relevant to this request (soonest +
  // keyword matches) instead of dumping the whole calendar — smaller, faster,
  // more accurate. This retrieved list is the source of truth for booking refs.
  const ctx = await retrieveCalendarContext(u.id, parsed.data.text);
  const tz = ctx.timezone;

  const contexts: BookingContext[] = ctx.bookings.map((b, i) => ({
    ref: i + 1,
    title: b.title,
    whenLocal: DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a"),
    attendees: b.attendees,
  }));

  const commandArgs = {
    text: parsed.data.text,
    timezone: tz,
    now: new Date(),
    bookings: contexts,
    eventTypes: ctx.eventTypes,
  };
  let draft: Awaited<ReturnType<typeof parseCommand>>;
  try {
    // Availability-dependent requests → the agentic loop (can look up free
    // slots); everything else → the faster single-shot parse.
    draft = needsAvailability(parsed.data.text)
      ? await runSchedulingAgent({ ...commandArgs, userId: u.id })
      : await parseCommand(commandArgs);
  } catch (err) {
    logger.error("ai command parse failed", { event: "ai_command_failed", userId: u.id, err });
    return jsonError("Couldn't understand that. Try rephrasing, or manage it manually.", 502);
  }

  // For a create that named one of the user's event types, surface the match so
  // the client can show it and the create uses the type's real duration.
  let matchedEventType: { title: string; slug: string; durationMinutes: number } | null = null;
  if (draft.intent === "create" && draft.eventTypeSlug) {
    const et = ctx.eventTypes.find((e) => e.slug === draft.eventTypeSlug);
    if (et) matchedEventType = et;
  }

  // For manage intents, resolve the model's ref to a real booking the user owns
  // and attach a summary so the client can render a clear confirmation.
  let target: { uid: string; title: string; startISO: string } | null = null;
  if (draft.intent === "reschedule" || draft.intent === "cancel") {
    const b = ctx.bookings[draft.bookingRef - 1];
    if (!b) {
      return NextResponse.json({
        draft: {
          ...draft,
          understood: false,
          message:
            draft.message || "I couldn't tell which meeting you meant. Try naming it or its time.",
        },
        target: null,
      });
    }
    target = { uid: b.uid, title: b.title, startISO: b.startsAt.toISOString() };
  }

  return NextResponse.json({ draft, target, matchedEventType });
});
