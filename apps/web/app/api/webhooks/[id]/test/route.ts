import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { enqueueWebhook } from "@dayotter/jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Send a signed test ping to one of the caller's webhook endpoints. */
export const POST = withUser(async (u, _req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const endpoint = await getDb().query.webhookEndpoints.findFirst({
    where: and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, u.id)),
    columns: { id: true },
  });
  if (!endpoint) return jsonError("Not found", 404);

  const [delivery] = await getDb()
    .insert(schema.webhookDeliveries)
    .values({
      endpointId: id,
      event: "ping",
      payload: { event: "ping", createdAt: new Date().toISOString(), data: { ok: true } },
    })
    .returning({ id: schema.webhookDeliveries.id });
  if (delivery) await enqueueWebhook(delivery.id);

  return NextResponse.json({ ok: true, deliveryId: delivery?.id });
});
