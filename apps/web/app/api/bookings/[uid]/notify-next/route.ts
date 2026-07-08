import { notifyNextMeetingDelayed } from "@/lib/booking/running-late";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ minutes: z.number().int().min(1).max(120).optional() });

/**
 * Overflow (#6): host taps "running late for my next meeting" → notify the
 * attendees of the meeting booked right after this one. Host-only.
 */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  const minutes = parsed.success ? parsed.data.minutes : undefined;

  const result = await notifyNextMeetingDelayed(uid, u.id, minutes);
  if (result === "not_found") return jsonError("Booking not found", 404);
  if (result === "forbidden") return jsonError("Not your booking", 403);
  if (result === "no_next") return jsonError("No back-to-back meeting to notify.", 409);
  return NextResponse.json({ ok: true });
});
