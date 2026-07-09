import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Disconnect a calendar account: delete the connection (its calendars, synced
 * events, busy blocks and webhook subscriptions cascade away). Any provider-side
 * push channels simply expire — we stop renewing them. Ownership-checked.
 */
export const DELETE = withUser(
  async (user, _request, ctx: { params: Promise<{ connectionId: string }> }) => {
    const { connectionId } = await ctx.params;
    const db = getDb();

    const deleted = await db
      .delete(schema.calendarConnections)
      .where(
        and(
          eq(schema.calendarConnections.id, connectionId),
          eq(schema.calendarConnections.userId, user.id),
        ),
      )
      .returning({ id: schema.calendarConnections.id });

    if (deleted.length === 0) return jsonError("Connection not found", 404);
    return NextResponse.json({ ok: true });
  },
);
