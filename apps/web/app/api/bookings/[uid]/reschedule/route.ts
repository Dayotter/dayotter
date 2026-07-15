import { RescheduleError, rescheduleBooking } from "@/lib/booking/reschedule-booking";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  start: z.string().datetime(),
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params;
  // Capability-uid only (unauthenticated) + does real work (availability recompute,
  // calendar write, emails) - throttle per uid so a leaked link can't be abused.
  const limited = await enforceRateLimit(request, {
    name: "reschedule",
    limit: 8,
    windowSec: 600,
    key: uid,
  });
  if (limited) return limited;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  try {
    await rescheduleBooking(uid, parsed.data.start, parsed.data.reason?.trim() || undefined);
    return NextResponse.json({ ok: true, url: `/booking/${uid}` });
  } catch (err) {
    if (err instanceof RescheduleError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/reschedule] error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
