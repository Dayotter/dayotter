import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { enqueueWebhook } from "@dayotter/jobs";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ deliveryId: z.string().uuid() });

/** Re-send a past delivery (e.g. one that failed while the consumer was down). */
export const POST = withUser(async (u, request, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("deliveryId required", 400);

  const endpoint = await getDb().query.webhookEndpoints.findFirst({
    where: and(eq(schema.webhookEndpoints.id, id), eq(schema.webhookEndpoints.userId, u.id)),
    columns: { id: true },
  });
  if (!endpoint) return jsonError("Not found", 404);

  // The delivery must belong to this endpoint.
  const [reset] = await getDb()
    .update(schema.webhookDeliveries)
    .set({ status: "pending", responseStatus: null })
    .where(
      and(
        eq(schema.webhookDeliveries.id, parsed.data.deliveryId),
        eq(schema.webhookDeliveries.endpointId, id),
      ),
    )
    .returning({ id: schema.webhookDeliveries.id });
  if (!reset) return jsonError("Delivery not found", 404);

  await enqueueWebhook(reset.id);
  return NextResponse.json({ ok: true });
});
