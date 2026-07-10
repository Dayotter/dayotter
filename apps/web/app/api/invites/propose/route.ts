import { proposeInviteTime } from "@/lib/calendar/invite-actions";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@calsync/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  connectionId: z.string().uuid(),
  calendarExternalId: z.string().min(1),
  externalEventId: z.string().min(1),
  organizerEmail: z.string().email(),
  title: z.string().min(1).max(300),
  originalISO: z.string().datetime(),
  proposedISO: z.string().datetime(),
  message: z.string().max(1000).optional(),
});

/** Propose a new time to a pending invite's organizer (emails them + tentative RSVP). */
export const POST = withUser(async (u, request) => {
  const limited = await enforceRateLimit(request, {
    name: "invite-propose",
    limit: 20,
    windowSec: 600,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  try {
    const result = await proposeInviteTime({
      userId: u.id,
      userName: u.name || u.email,
      ...parsed.data,
    });
    if (result === "not_found") return jsonError("Connection not found", 404);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("invite propose failed", { event: "invite_propose_failed", userId: u.id, err });
    return jsonError("Couldn't send your proposal. Please try again.", 502);
  }
});
