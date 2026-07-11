import { jsonError, withUser } from "@/lib/server/http";
import { and, desc, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Recent delivery attempts for one of the caller's webhook endpoints. */
export const GET = withUser(async (u, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const endpoint = await getDb().query.webhookEndpoints.findFirst({
    where: and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, u.id)),
    columns: { id: true },
  });
  if (!endpoint) return jsonError("Not found", 404);

  const rows = await getDb().query.webhookDeliveries.findMany({
    where: eq(schema.webhookDeliveries.endpointId, id),
    orderBy: [desc(schema.webhookDeliveries.createdAt)],
    limit: 20,
    columns: {
      id: true,
      event: true,
      status: true,
      responseStatus: true,
      attempts: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    deliveries: rows.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      responseStatus: d.responseStatus,
      attempts: d.attempts,
      createdAt: d.createdAt.toISOString(),
    })),
  });
});
