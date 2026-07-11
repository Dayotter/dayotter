import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Whether the caller has a Zoom account connected. */
export const GET = withUser(async (u) => {
  const conn = await getDb().query.conferencingConnections.findFirst({
    where: and(
      eq(schema.conferencingConnections.userId, u.id),
      eq(schema.conferencingConnections.provider, "zoom"),
    ),
    columns: { externalAccountId: true, status: true },
  });
  return NextResponse.json({
    connected: Boolean(conn && conn.status === "active"),
    account: conn?.externalAccountId ?? null,
  });
});

/** Disconnect Zoom. */
export const DELETE = withUser(async (u) => {
  const deleted = await getDb()
    .delete(schema.conferencingConnections)
    .where(
      and(
        eq(schema.conferencingConnections.userId, u.id),
        eq(schema.conferencingConnections.provider, "zoom"),
      ),
    )
    .returning({ id: schema.conferencingConnections.id });
  if (deleted.length === 0) return jsonError("Not connected", 404);
  return NextResponse.json({ ok: true });
});
