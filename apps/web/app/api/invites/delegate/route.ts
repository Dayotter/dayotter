import { delegateInvite } from "@/lib/calendar/invite-actions";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  delegateEmail: z.string().email(),
  title: z.string().min(1).max(300),
  startISO: z.string().datetime(),
  organizerName: z.string().max(200).nullish(),
  location: z.string().max(500).nullish(),
  meetingUrl: z.string().max(1000).nullish(),
  message: z.string().max(1000).optional(),
});

/** Delegate a pending invite to a teammate (emails them the meeting details). */
export const POST = withUser(async (u, request) => {
  const limited = await enforceRateLimit(request, {
    name: "invite-delegate",
    limit: 20,
    windowSec: 600,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  try {
    await delegateInvite({ userName: u.name || u.email, ...parsed.data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("invite delegate failed", { event: "invite_delegate_failed", userId: u.id, err });
    return jsonError("Couldn't send the delegation. Please try again.", 502);
  }
});
