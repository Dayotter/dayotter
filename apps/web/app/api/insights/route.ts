import { computeInsights } from "@/lib/booking/insights";
import { withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Scheduling-scoped time insights for the mobile Insights screen. */
export const GET = withUser(async (u) => {
  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });
  const insights = await computeInsights({ userId: u.id, tz: user?.timezone ?? "UTC" });
  return NextResponse.json({ insights });
});
