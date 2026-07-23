import { declineBooking } from "@/lib/booking/confirm-booking";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ reason: z.string().max(500).optional() });

/** Host declines a pending (opt-in) booking, rejecting the request. Host-only. */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason?.trim() || undefined : undefined;

  const result = await declineBooking(uid, u.id, reason);
  switch (result) {
    case "ok":
      return NextResponse.json({ ok: true, status: "rejected" });
    case "forbidden":
      return jsonError("Not your booking", 403);
    case "not_pending":
      return jsonError("Booking is not awaiting confirmation", 409);
    default:
      return jsonError("Booking not found", 404);
  }
});
