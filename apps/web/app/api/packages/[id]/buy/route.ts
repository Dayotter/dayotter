import { hostDestinationAccount } from "@/lib/payments/connect";
import { createCheckoutSession, paymentsEnabled } from "@/lib/payments/stripe";
import { jsonError } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ clientEmail: z.string().email() });

/**
 * Buy a session package. Creates a Stripe Checkout session; on payment the
 * webhook grants the client their credits (see webhooks/stripe). Public - a
 * client purchases against a host's public package.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!paymentsEnabled) return jsonError("Payments aren't enabled on this server.", 503);
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("A valid email is required", 400);

  const pkg = await getDb().query.sessionPackages.findFirst({
    where: eq(schema.sessionPackages.id, id),
  });
  if (!pkg || !pkg.isActive) return jsonError("Package not available", 404);
  if (pkg.priceAmount <= 0) return jsonError("This package isn't for sale", 400);

  // Route the sale to the host's connected account (the event-type owner).
  const et = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, pkg.eventTypeId),
    columns: { ownerId: true },
  });
  const destinationAccountId = et ? await hostDestinationAccount(et.ownerId) : undefined;

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const session = await createCheckoutSession({
    amount: pkg.priceAmount,
    currency: pkg.currency,
    productName: `${pkg.name} - ${pkg.sessionCount} sessions`,
    successUrl: `${appUrl}/packages/thanks`,
    cancelUrl: `${appUrl}`,
    customerEmail: parsed.data.clientEmail,
    destinationAccountId,
    metadata: {
      kind: "package",
      packageId: pkg.id,
      organizationId: pkg.organizationId,
      eventTypeId: pkg.eventTypeId,
      clientEmail: parsed.data.clientEmail.toLowerCase(),
      totalCredits: String(pkg.sessionCount),
    },
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
