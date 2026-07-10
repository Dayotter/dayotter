import { getEventTypeAvailability, recommendSlotsForEventType } from "@/lib/booking/availability";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  duration: z.coerce.number().int().min(5).max(1440).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ eventTypeId: string }> },
) {
  const limited = await enforceRateLimit(request, {
    name: "availability",
    limit: 120,
    windowSec: 60,
  });
  if (limited) return limited;

  const { eventTypeId } = await params;
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    duration: url.searchParams.get("duration") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Clamp the window so a public caller can't force an unbounded (e.g. year-2200)
  // slot computation over the whole calendar as a cheap CPU/DB-exhaustion DoS.
  const MAX_WINDOW_MS = 62 * 86_400_000; // ~2 months of slots per request
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date();
  const requestedTo = parsed.data.to
    ? new Date(parsed.data.to)
    : new Date(from.getTime() + 14 * 86_400_000);
  if (requestedTo.getTime() <= from.getTime()) {
    return NextResponse.json({ error: "`to` must be after `from`" }, { status: 400 });
  }
  const to = new Date(Math.min(requestedTo.getTime(), from.getTime() + MAX_WINDOW_MS));

  const slots = await getEventTypeAvailability(eventTypeId, from, to, parsed.data.duration);
  if (slots === null) {
    return NextResponse.json({ error: "Event type not found" }, { status: 404 });
  }

  // Smart-scheduling: highlight a few recommended times (individual events only).
  const recommended = await recommendSlotsForEventType(eventTypeId, slots);

  return NextResponse.json({
    eventTypeId,
    from: from.toISOString(),
    to: to.toISOString(),
    slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })),
    recommended,
  });
}
