import { withApiKey } from "@/lib/server/api-key";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** GET /api/v1/event-types — the account's active event types. */
export const GET = withApiKey(async (caller) => {
  const rows = await getDb().query.eventTypes.findMany({
    where: and(eq(schema.eventTypes.ownerId, caller.userId), eq(schema.eventTypes.isActive, true)),
    columns: {
      id: true,
      slug: true,
      title: true,
      description: true,
      durationMinutes: true,
      location: true,
      price: true,
      currency: true,
    },
  });
  return NextResponse.json({ eventTypes: rows });
});
