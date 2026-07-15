import { connectEnabled, createExpressLoginLink } from "@/lib/payments/stripe";
import { withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 302 to the host's Stripe Express dashboard (payout history, bank + tax
 * details). A plain GET so it's a full browser navigation, like connect. Falls
 * back to onboarding if the host hasn't set up an account yet.
 */
export const GET = withUser(async (u) => {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const settings = `${appUrl}/settings/payouts`;
  if (!connectEnabled) return NextResponse.redirect(`${settings}?error=unconfigured`);

  try {
    const user = await getDb().query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { stripeAccountId: true },
    });
    // No account yet → send them through onboarding instead.
    if (!user?.stripeAccountId) return NextResponse.redirect(`${appUrl}/api/payments/connect`);
    const url = await createExpressLoginLink(user.stripeAccountId);
    return NextResponse.redirect(url);
  } catch (err) {
    logger.error("stripe express dashboard link failed", {
      event: "express_dashboard_failed",
      userId: u.id,
      err,
    });
    return NextResponse.redirect(`${settings}?error=dashboard`);
  }
});
