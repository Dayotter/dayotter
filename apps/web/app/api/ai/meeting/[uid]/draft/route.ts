import { aiEnabled } from "@/lib/ai/llm";
import { draftMeetingReply } from "@/lib/ai/meeting-actions";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ instruction: z.string().min(1).max(500) });

/** Draft a meeting-scoped message from the host to the attendees. Never sends. */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  if (!aiEnabled) return jsonError("AI isn't enabled on this server.", 503);
  const limited = await enforceRateLimit(request, {
    name: "ai-meeting",
    limit: 20,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter what you'd like to say", 400);

  const booking = await getDb().query.bookings.findFirst({
    where: eq(schema.bookings.uid, uid),
    with: { attendees: true, host: true },
  });
  if (!booking) return jsonError("Meeting not found", 404);
  if (booking.hostId !== u.id) return jsonError("Not your meeting", 403);

  const whenText = DateTime.fromJSDate(booking.startsAt)
    .setZone(booking.timezone)
    .toFormat("cccc, LLL d 'at' h:mm a");

  try {
    const reply = await draftMeetingReply({
      meeting: {
        title: booking.title,
        whenText,
        hostName: booking.host?.name ?? "the host",
        attendeeName: booking.attendees[0]?.name ?? booking.attendees[0]?.email ?? "the attendee",
      },
      instruction: parsed.data.instruction,
    });
    return NextResponse.json({ reply });
  } catch (err) {
    logger.error("ai meeting draft failed", {
      event: "ai_meeting_draft_failed",
      userId: u.id,
      err,
    });
    return jsonError("Couldn't draft that. Try rephrasing.", 502);
  }
});
