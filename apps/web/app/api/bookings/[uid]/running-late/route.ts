import { notifyRunningLate } from "@/lib/booking/running-late";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ minutes: z.number().int().min(1).max(120).optional() });

/** Host taps "I'm running late" → notify this booking's attendees. Host-only. */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  const minutes = parsed.success ? parsed.data.minutes : undefined;

  const result = await notifyRunningLate(uid, u.id, minutes);
  if (result === "not_found") return jsonError("Booking not found", 404);
  if (result === "forbidden") return jsonError("Not your booking", 403);
  return NextResponse.json({ ok: true });
});
