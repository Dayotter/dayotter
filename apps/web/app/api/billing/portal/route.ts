import { isCloud } from "@/lib/billing/edition";
import { primaryOrg } from "@/lib/billing/entitlements";
import { createBillingPortalSession, subscriptionsEnabled } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Open the Stripe billing portal (update seats / card / cancel). Owner/admin only. */
export const POST = withUser(async (u) => {
  if (!isCloud || !subscriptionsEnabled) return jsonError("Billing is not available.", 400);

  const org = await primaryOrg(u.id);
  if (!org?.stripeCustomerId) return jsonError("No active subscription.", 404);

  const membership = await getDb().query.memberships.findFirst({
    where: and(
      eq(schema.memberships.organizationId, org.id),
      eq(schema.memberships.userId, u.id),
    ),
  });
  if (!membership || membership.role === "member") {
    return jsonError("Only an owner or admin can manage billing.", 403);
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  try {
    const { url } = await createBillingPortalSession(
      org.stripeCustomerId,
      `${appUrl}/settings/billing`,
    );
    return NextResponse.json({ url });
  } catch {
    return jsonError("Couldn't open the billing portal.", 502);
  }
});
