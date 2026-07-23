import { approveBooking } from "@/lib/booking/confirm-booking";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Host approves a pending (opt-in) booking, confirming it. Host-only. */
export const POST = withUser(async (u, _request, ctx: { params: Promise<{ uid: string }> }) => {
  const { uid } = await ctx.params;
  const result = await approveBooking(uid, u.id);
  switch (result) {
    case "ok":
      return NextResponse.json({ ok: true, status: "confirmed" });
    case "forbidden":
      return jsonError("Not your booking", 403);
    case "not_pending":
      return jsonError("Booking is not awaiting confirmation", 409);
    case "full":
      return jsonError("That time was taken before you could approve it.", 409);
    default:
      return jsonError("Booking not found", 404);
  }
});
