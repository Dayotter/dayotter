import { fetchBookerBusy } from "@/lib/booking/overlay";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { SsrfError } from "@calsync/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  icsUrl: z.string().min(1).max(2000),
  from: z.string().datetime(),
  to: z.string().datetime(),
});

/**
 * SavvyCal-style overlay: given the booker's calendar feed URL, return their
 * busy intervals in the requested window so the public booking page can flag
 * slots that clash with the booker's own commitments. Public + unauthenticated
 * (it's a booking-page feature), so it's tightly rate-limited and the fetch is
 * SSRF-guarded (https-only, DNS-pinned, size/time capped). The feed is never
 * stored — only busy/free times are derived and returned.
 */
export async function POST(request: Request) {
  const limited = await enforceRateLimit(request, { name: "overlay", limit: 20, windowSec: 300 });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const from = new Date(parsed.data.from);
  const requestedTo = new Date(parsed.data.to);
  if (requestedTo <= from) {
    return NextResponse.json({ error: "`to` must be after `from`" }, { status: 400 });
  }
  // Clamp the window to ~4 weeks so a feed scan stays bounded.
  const to = new Date(Math.min(requestedTo.getTime(), from.getTime() + 28 * 86_400_000));

  try {
    const busy = await fetchBookerBusy(parsed.data.icsUrl, from, to);
    return NextResponse.json({ busy });
  } catch (err) {
    if (err instanceof SsrfError) {
      return NextResponse.json(
        { error: "That calendar address isn't reachable. Use a public https iCal/ICS link." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Couldn't read that calendar. Check the link is a valid iCal/ICS feed." },
      { status: 400 },
    );
  }
}
