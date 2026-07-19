import {
  type CurrencyBalance,
  WITHDRAW_MINIMUM,
  connectedBalances,
  paymentsEnabled,
  platformFeePercent,
  retrieveConnectStatus,
} from "@/lib/payments/stripe";
import { withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stripe Connect payout status for the signed-in host (the mobile Payouts
 * screen; the web settings page computes the same values server-side). Mirrors
 * the balance + onboarding flags the web page hands to <PayoutsPanel>.
 */
export const GET = withUser(async (u) => {
  if (!paymentsEnabled) {
    return NextResponse.json({ paymentsEnabled: false });
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { stripeAccountId: true },
  });

  let chargesEnabled = false;
  let payoutsEnabled = false;
  let detailsSubmitted = false;
  let balances: CurrencyBalance[] = [];

  if (user?.stripeAccountId) {
    try {
      const status = await retrieveConnectStatus(user.stripeAccountId);
      chargesEnabled = status.chargesEnabled;
      payoutsEnabled = status.payoutsEnabled;
      detailsSubmitted = status.detailsSubmitted;
      // Persist the fresh flags so charge-routing + withdraw don't wait on the webhook.
      await db
        .update(schema.users)
        .set({ stripeChargesEnabled: chargesEnabled, stripePayoutsEnabled: payoutsEnabled })
        .where(eq(schema.users.id, u.id));
      if (payoutsEnabled) balances = await connectedBalances(user.stripeAccountId);
    } catch {
      /* Stripe hiccup - report unconnected so the host can re-connect. */
    }
  }

  return NextResponse.json({
    paymentsEnabled: true,
    connected: Boolean(user?.stripeAccountId),
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    balances,
    minimum: WITHDRAW_MINIMUM,
    feePercent: platformFeePercent,
  });
});
