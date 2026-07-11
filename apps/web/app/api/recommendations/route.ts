import { getRecommendations } from "@/lib/intelligence/recommendations";
import { withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Intelligence recommendations (calendar-health) for the mobile Home screen. */
export const GET = withUser(async (u) => {
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });
  const recommendations = await getRecommendations({
    userId: u.id,
    tz: user?.timezone ?? "UTC",
  });
  return NextResponse.json({ recommendations });
});
