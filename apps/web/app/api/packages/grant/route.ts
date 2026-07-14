import { grantCredits } from "@/lib/packages/credits";
import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  packageId: z.string().uuid(),
  clientEmail: z.string().email(),
});

/**
 * Manually grant a package's credits to a client - for hosts who sell offline
 * (invoice, in person) or want to comp a client, without going through Stripe.
 */
export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the details", 400);
  const { packageId, clientEmail } = parsed.data;

  // The package must belong to one of the host's event types.
  const pkg = await getDb().query.sessionPackages.findFirst({
    where: eq(schema.sessionPackages.id, packageId),
  });
  if (!pkg) return jsonError("Package not found", 404);
  const owns = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, pkg.eventTypeId), eq(schema.eventTypes.ownerId, u.id)),
    columns: { id: true },
  });
  if (!owns) return jsonError("Package not found", 404);

  await grantCredits({
    organizationId: pkg.organizationId,
    eventTypeId: pkg.eventTypeId,
    clientEmail,
    totalCredits: pkg.sessionCount,
    packageId: pkg.id,
  });

  return NextResponse.json({ ok: true });
});
