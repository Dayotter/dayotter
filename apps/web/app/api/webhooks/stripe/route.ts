import { syncOrgSubscription, syncSubscriptionById } from "@/lib/billing/subscription";
import { fulfillPackagePurchase } from "@/lib/packages/fulfill";
import { syncConnectAccountStatus } from "@/lib/payments/connect";
import { fulfillCheckout } from "@/lib/payments/fulfill";
import { constructWebhookEvent, paymentsEnabled } from "@/lib/payments/stripe";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import type Stripe from "stripe";

export const dynamic = "force-dynamic";

/** Stripe webhook - the reliable backstop that confirms a paid booking even if
 *  the booker closes the success tab. Signature-verified; idempotent. */
export async function POST(request: Request) {
  if (!paymentsEnabled) return NextResponse.json({ ok: true });

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await request.text();
  let event: ReturnType<typeof constructWebhookEvent>;
  try {
    event = constructWebhookEvent(payload, signature);
  } catch (err) {
    logger.warn("stripe webhook signature invalid", { event: "stripe_webhook_bad_sig", err });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          // A Pro subscription checkout - activate the org's plan.
          await syncSubscriptionById(session.subscription as string);
        } else if (session.metadata?.kind === "package") {
          // A prepaid session-package purchase - grant the client's credits.
          await fulfillPackagePurchase(session);
        } else {
          // A one-off booking payment.
          await fulfillCheckout(session.id);
        }
        break;
      }
      // Keep the org plan in sync with upgrades, seat changes, payment failures,
      // and cancellations. This is the source of truth for the plan.
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncOrgSubscription(event.data.object as Stripe.Subscription);
        break;

      // A host's Connect account finished (or changed) onboarding - mirror its
      // charges/payouts capability flags onto the user.
      case "account.updated":
        await syncConnectAccountStatus(event.data.object as Stripe.Account);
        break;
    }
  } catch (err) {
    logger.error("stripe webhook handler failed", {
      event: "stripe_webhook_handler_failed",
      type: event.type,
      err,
    });
    // Return 200 anyway so Stripe doesn't retry something already reconciled.
  }

  return NextResponse.json({ received: true });
}
