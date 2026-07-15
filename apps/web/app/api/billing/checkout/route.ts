import { isCloud } from "@/lib/billing/edition";
import { primaryOrg } from "@/lib/billing/entitlements";
import { seatCount } from "@/lib/billing/subscription";
import { createSubscriptionCheckout, subscriptionsEnabled } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start a Pro subscription checkout for the caller's org (owner/admin only). */
export const POST = withUser(async (u) => {
  if (!isCloud) return jsonError("Billing is only available on DayOtter Cloud.", 400);
  if (!subscriptionsEnabled) return jsonError("Billing is not configured.", 400);

  const org = await primaryOrg(u.id);
  if (!org) return jsonError("No organization", 404);

  // Only owners/admins can start billing.
  const membership = await getDb().query.memberships.findFirst({
    where: and(eq(schema.memberships.organizationId, org.id), eq(schema.memberships.userId, u.id)),
  });
  if (!membership || membership.role === "member") {
    return jsonError("Only an owner or admin can manage billing.", 403);
  }

  if (org.plan === "pro") return jsonError("You're already on Pro.", 409);

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const { url } = await createSubscriptionCheckout({
      organizationId: org.id,
      quantity: await seatCount(org.id),
      customerId: org.stripeCustomerId,
      customerEmail: u.email,
      successUrl: `${appUrl}/settings/billing?upgraded=1`,
      cancelUrl: `${appUrl}/settings/billing`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    // Almost always a Stripe config issue (invalid STRIPE_PRICE_PRO, a non-recurring
    // price, or a test/live key mix-up). Log it AND return the detail - this route is
    // owner/admin-only, so surfacing the real cause beats an opaque 502.
    const detail = err instanceof Error ? err.message : String(err);
    logger.error("stripe checkout failed", {
      event: "billing_checkout_failed",
      userId: u.id,
      organizationId: org.id,
      err,
    });
    return NextResponse.json(
      { error: "Couldn't start checkout. Check the Stripe configuration.", detail },
      { status: 500 },
    );
  }
});
