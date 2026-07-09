import { computeAnalytics } from "@/lib/booking/analytics";
import { requireFeature } from "@/lib/billing/require-feature";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Booking-funnel analytics for a window (default last 30 days). */
export const GET = withUser(async (u, request) => {
  const gate = await requireFeature(u.id, "analytics");
  if (gate) return gate;
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get("days")) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const analytics = await computeAnalytics({ userId: u.id, from, to });
  return NextResponse.json({ analytics, days });
});
