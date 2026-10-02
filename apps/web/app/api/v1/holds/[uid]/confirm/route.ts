import { confirmHold } from "@/lib/booking/holds";
import { withApiKey } from "@/lib/server/api-key";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/holds/:uid/confirm - turn a live hold into a confirmed booking,
 * running the full confirmed-booking side-effects (calendar, reminders, emails,
 * webhooks). Idempotent: confirming an already-confirmed hold returns 200. A hold
 * that has lapsed returns 410.
 */
export const POST = withApiKey(
  async (caller, _request, ctx: { params: Promise<{ uid: string }> }) => {
    const { uid } = await ctx.params;
    const result = await confirmHold(uid, caller.userId);

    switch (result.status) {
      case "confirmed":
        return NextResponse.json(
          { uid, status: "confirmed", alreadyConfirmed: result.alreadyConfirmed },
          { status: 200 },
        );
      case "expired":
        return NextResponse.json({ error: "This hold has expired." }, { status: 410 });
      default:
        return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    }
  },
);
