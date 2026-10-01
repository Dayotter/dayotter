import { releaseHold } from "@/lib/booking/holds";
import { withApiKey } from "@/lib/server/api-key";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/v1/holds/:uid - release a hold before it lapses, reopening the slot
 * at once. Idempotent: releasing an already-gone hold still returns 200. A hold
 * that has already been confirmed into a real booking returns 409 (cancel it
 * through the booking APIs instead).
 */
export const DELETE = withApiKey(
  async (caller, _request, ctx: { params: Promise<{ uid: string }> }) => {
    const { uid } = await ctx.params;
    const result = await releaseHold(uid, caller.userId);

    switch (result.status) {
      case "released":
        return NextResponse.json({ uid, status: "released" }, { status: 200 });
      case "already_confirmed":
        return NextResponse.json(
          { error: "This hold is already confirmed. Cancel the booking instead." },
          { status: 409 },
        );
      default:
        return NextResponse.json({ error: "Hold not found" }, { status: 404 });
    }
  },
);
