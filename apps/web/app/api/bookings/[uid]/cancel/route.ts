import { cancelBooking } from "@/lib/booking/cancel-booking";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  // Capability-uid only (unauthenticated) + does real work (calendar delete,
  // refund, emails) - throttle per uid so a leaked link can't be abused.
  const limited = await enforceRateLimit(request, {
    name: "cancel",
    limit: 8,
    windowSec: 600,
    key: uid,
  });
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason?.trim() || undefined : undefined;
  const ok = await cancelBooking(uid, reason);
  if (!ok) {
    return NextResponse.json({ error: "Booking not found or already cancelled" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
