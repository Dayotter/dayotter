import { PageHeader } from "@/components/page-header";
import { PayoutsPanel } from "@/components/payouts-panel";
import { Card, CardBody } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import {
  WITHDRAW_MINIMUM,
  connectedBalance,
  paymentsEnabled,
  platformFeePercent,
  retrieveConnectStatus,
} from "@/lib/payments/stripe";
import { eq, getDb, schema } from "@dayotter/db";

export const dynamic = "force-dynamic";

export default async function PayoutsSettingsPage() {
  const session = await getSession();
  const userId = session!.user.id;

  if (!paymentsEnabled) {
    return (
      <div>
        <PageHeader eyebrow="Payments" title="Payouts" />
        <Card className="max-w-2xl">
          <CardBody className="p-6 text-sm text-[var(--color-muted)]">
            Payments aren't configured on this server. Set <code>STRIPE_SECRET_KEY</code> (and
            enable Connect in your Stripe Dashboard) to let hosts get paid for bookings and
            packages.
          </CardBody>
        </Card>
      </div>
    );
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { stripeAccountId: true },
  });

  let charges = false;
  let payouts = false;
  let submitted = false;
  let available = 0;
  let currency = "usd";

  if (user?.stripeAccountId) {
    try {
      const status = await retrieveConnectStatus(user.stripeAccountId);
      charges = status.chargesEnabled;
      payouts = status.payoutsEnabled;
      submitted = status.detailsSubmitted;
      // Persist the fresh flags so charge-routing + withdraw don't wait on the webhook.
      await db
        .update(schema.users)
        .set({ stripeChargesEnabled: charges, stripePayoutsEnabled: payouts })
        .where(eq(schema.users.id, userId));
      if (payouts) {
        const bal = await connectedBalance(user.stripeAccountId);
        available = bal.available;
        currency = bal.currency;
      }
    } catch {
      /* Stripe hiccup - fall through and let the host re-connect. */
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Payments"
        title="Payouts"
        description="Get paid directly for paid bookings and session packages."
      />
      <PayoutsPanel
        connected={Boolean(user?.stripeAccountId)}
        chargesEnabled={charges}
        payoutsEnabled={payouts}
        detailsSubmitted={submitted}
        available={available}
        currency={currency}
        minimum={WITHDRAW_MINIMUM}
        feePercent={platformFeePercent}
      />
    </div>
  );
}
