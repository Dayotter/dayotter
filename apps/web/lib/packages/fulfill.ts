import { grantCredits } from "@/lib/packages/credits";
import { logger } from "@dayotter/core";
import type Stripe from "stripe";

/**
 * Grant a client their package credits after a successful Checkout. Idempotent
 * on the payment intent, so Stripe webhook retries never double-grant.
 */
export async function fulfillPackagePurchase(session: Stripe.Checkout.Session): Promise<void> {
  const m = session.metadata ?? {};
  const total = Number(m.totalCredits);
  if (
    !m.organizationId ||
    !m.eventTypeId ||
    !m.clientEmail ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    logger.warn("package checkout missing metadata", { event: "package_checkout_bad_meta" });
    return;
  }
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  await grantCredits({
    organizationId: m.organizationId,
    eventTypeId: m.eventTypeId,
    clientEmail: m.clientEmail,
    totalCredits: total,
    packageId: m.packageId ?? null,
    stripePaymentIntentId: paymentIntentId,
  });
  logger.info("package credits granted", { event: "package_credits_granted", total });
}
