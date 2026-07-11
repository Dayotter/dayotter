import { withUser } from "@/lib/server/http";
import { asc, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The user's connected calendar accounts (mobile Calendars screen). */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, u.id),
    orderBy: asc(schema.calendarConnections.createdAt),
    with: { calendars: { columns: { id: true } } },
  });
  return NextResponse.json({
    connections: rows.map((c) => ({
      id: c.id,
      provider: c.provider,
      account: c.externalAccountId,
      status: c.status,
      calendarCount: c.calendars.length,
      lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
      lastError: c.lastError,
    })),
  });
});
