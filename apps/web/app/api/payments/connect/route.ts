import { connectEnabled, createAccountLink, createConnectAccount } from "@/lib/payments/stripe";
import { withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Start (or resume) Stripe Connect Express onboarding for the host, then 302 to
 * Stripe's hosted onboarding. A plain GET so it's a full browser navigation (the
 * settings button is an <a>, not a Link - same reason as calendar connect).
 * Stripe's account link handles both first-time onboarding and re-entry on expiry.
 */
export const GET = withUser(async (u) => {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const settings = `${appUrl}/settings/payouts`;
  if (!connectEnabled) return NextResponse.redirect(`${settings}?error=unconfigured`);

  try {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { stripeAccountId: true, email: true },
    });
    let accountId = user?.stripeAccountId ?? null;
    if (!accountId) {
      accountId = await createConnectAccount(user?.email ?? u.email);
      await db
        .update(schema.users)
        .set({ stripeAccountId: accountId })
        .where(eq(schema.users.id, u.id));
    }
    const url = await createAccountLink(
      accountId,
      `${appUrl}/api/payments/connect`, // refresh: re-mint the link if it expires
      `${settings}?connected=1`,
    );
    return NextResponse.redirect(url);
  } catch (err) {
    logger.error("stripe connect onboarding failed", {
      event: "connect_onboarding_failed",
      userId: u.id,
      err,
    });
    return NextResponse.redirect(`${settings}?error=onboarding`);
  }
});
