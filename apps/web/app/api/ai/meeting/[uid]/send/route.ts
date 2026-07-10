import { messageBookingAttendees } from "@/lib/booking/message-attendees";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ message: z.string().min(1).max(2000) });

/** Send the host-confirmed (possibly edited) message to the meeting's attendees. */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Message is required", 400);

  const result = await messageBookingAttendees(uid, u.id, parsed.data.message.trim());
  if (result === "not_found") return jsonError("Meeting not found", 404);
  if (result === "forbidden") return jsonError("Not your meeting", 403);
  return NextResponse.json({ ok: true });
});
