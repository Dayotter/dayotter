import { computeTimeAllocation } from "@/lib/analytics/time-allocation";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** "Where your time goes" — time-allocation metrics over the last N days. */
export const GET = withUser(async (u, request) => {
  const days = Number(new URL(request.url).searchParams.get("days")) || 30;
  const windowDays = Math.min(90, Math.max(7, days));
  const result = await computeTimeAllocation({ userId: u.id, windowDays });
  return NextResponse.json(result);
});
