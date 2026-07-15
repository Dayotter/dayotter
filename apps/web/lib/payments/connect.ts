import { eq, getDb, schema } from "@dayotter/db";
import type Stripe from "stripe";

/**
 * The host's connected account to route a charge to - but only once they can
 * actually accept charges. Returns undefined otherwise, so payment falls back to
 * the platform account (legacy behaviour) instead of failing.
 */
export async function hostDestinationAccount(
  userId: string | null | undefined,
): Promise<string | undefined> {
  if (!userId) return undefined;
  const u = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { stripeAccountId: true, stripeChargesEnabled: true },
  });
  return u?.stripeChargesEnabled && u.stripeAccountId ? u.stripeAccountId : undefined;
}

/**
 * Mirror a Stripe Connect account's capability flags onto the host user (matched
 * by stripeAccountId). Called from the `account.updated` webhook and after the
 * host returns from onboarding, so the settings UI reflects reality.
 */
export async function syncConnectAccountStatus(account: Stripe.Account): Promise<void> {
  await getDb()
    .update(schema.users)
    .set({
      stripeChargesEnabled: Boolean(account.charges_enabled),
      stripePayoutsEnabled: Boolean(account.payouts_enabled),
    })
    .where(eq(schema.users.stripeAccountId, account.id));
}
