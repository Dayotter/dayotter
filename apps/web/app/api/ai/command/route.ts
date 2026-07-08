import { type BookingContext, aiEnabled, parseCommand } from "@/lib/ai/command-parse";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@calsync/core";
import { and, asc, eq, getDb, gte, schema } from "@calsync/db";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ text: z.string().min(1).max(500) });

/**
 * Natural-language command → an editable draft (create / reschedule / cancel).
 * Confirm-first: this only interprets against the user's own upcoming bookings;
 * it never writes. The client confirms, then calls the write endpoints.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);

  const limited = await enforceRateLimit(request, {
    name: "ai-command",
    limit: 20,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a request", 400);

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";

  // The host's upcoming confirmed bookings — the only ones AI may act on.
  const upcoming = await db.query.bookings.findMany({
    where: and(
      eq(schema.bookings.hostId, u.id),
      eq(schema.bookings.status, "confirmed"),
      gte(schema.bookings.startsAt, new Date()),
    ),
    orderBy: asc(schema.bookings.startsAt),
    limit: 25,
    with: { attendees: { columns: { name: true, email: true } } },
  });

  const contexts: BookingContext[] = upcoming.map((b, i) => ({
    ref: i + 1,
    title: b.title,
    whenLocal: DateTime.fromJSDate(b.startsAt).setZone(tz).toFormat("ccc, LLL d 'at' h:mm a"),
    attendees: b.attendees.map((a) => a.name ?? a.email),
  }));

  let draft: Awaited<ReturnType<typeof parseCommand>>;
  try {
    draft = await parseCommand({
      text: parsed.data.text,
      timezone: tz,
      now: new Date(),
      bookings: contexts,
    });
  } catch (err) {
    logger.error("ai command parse failed", { event: "ai_command_failed", userId: u.id, err });
    return jsonError("Couldn't understand that. Try rephrasing, or manage it manually.", 502);
  }

  // For manage intents, resolve the model's ref to a real booking the user owns
  // and attach a summary so the client can render a clear confirmation.
  let target: { uid: string; title: string; startISO: string } | null = null;
  if (draft.intent === "reschedule" || draft.intent === "cancel") {
    const b = upcoming[draft.bookingRef - 1];
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

  return NextResponse.json({ draft, target });
});
