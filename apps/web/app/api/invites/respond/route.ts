import { respondToInvite } from "@/lib/calendar/invites";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  connectionId: z.string().uuid(),
  calendarExternalId: z.string().min(1),
  externalEventId: z.string().min(1),
  response: z.enum(["accepted", "declined", "tentative"]),
});

/** RSVP to a pending invitation (accept / decline / tentative). */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  try {
    const result = await respondToInvite({ userId: u.id, ...parsed.data });
    if (result === "not_found") return jsonError("Connection not found", 404);
    if (result === "unsupported") return jsonError("This provider can't RSVP here", 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("invite respond failed", { event: "invite_respond_failed", userId: u.id, err });
    return jsonError("Couldn't send your response. Please try again.", 502);
  }
});
