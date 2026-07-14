import { logger } from "@dayotter/core";
import Stripe from "stripe";

/**
 * The single Stripe layer. Env-gated: paid bookings are disabled unless
 * STRIPE_SECRET_KEY is set, so a self-hoster without Stripe is unaffected.
 * Every payment path goes through here - no route instantiates its own client.
 */
export const paymentsEnabled = Boolean(process.env.STRIPE_SECRET_KEY);

let client: Stripe | null = null;
function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured");
  if (!client) client = new Stripe(key);
  return client;
}

export interface CheckoutParams {
  amount: number; // minor units
  currency: string;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  /** Opaque data echoed back on the session so the webhook can create the booking. */
  metadata: Record<string, string>;
}

/** Create a one-off Checkout Session and return its hosted URL + id. */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<{ id: string; url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency,
          unit_amount: params.amount,
          product_data: { name: params.productName },
        },
      },
    ],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    customer_email: params.customerEmail,
    metadata: params.metadata,
    payment_intent_data: { metadata: params.metadata },
  });
  return { id: session.id, url: session.url ?? "" };
}

/** Retrieve a session (used by the success handler to confirm payment). */
export function retrieveSession(id: string): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.retrieve(id);
}

/** Refund a captured payment (best-effort). Returns true on success. */
export async function refundPayment(paymentIntentId: string): Promise<boolean> {
  try {
    await stripe().refunds.create({ payment_intent: paymentIntentId });
    return true;
  } catch (err) {
    logger.error("stripe refund failed", { event: "stripe_refund_failed", err });
    return false;
  }
}

/** Verify + parse a webhook payload. Throws if the signature is invalid. */
export function constructWebhookEvent(payload: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEvent(payload, signature, secret);
}

// ---- Subscription billing (cloud Pro plan, $9/seat/mo) ----

/** The recurring Stripe Price for the Pro plan; billing is disabled without it. */
export const proPriceId = process.env.STRIPE_PRICE_PRO ?? "";
export const subscriptionsEnabled = paymentsEnabled && Boolean(proPriceId);

/**
 * Start a per-seat Pro subscription checkout for an org. `quantity` = seat count.
 * Reuses/creates the org's Stripe customer so the portal + webhooks line up.
 */
export async function createSubscriptionCheckout(params: {
  organizationId: string;
  quantity: number;
  customerId?: string | null;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: proPriceId, quantity: Math.max(1, params.quantity) }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    ...(params.customerId
      ? { customer: params.customerId }
      : { customer_email: params.customerEmail }),
    client_reference_id: params.organizationId,
    subscription_data: { metadata: { organizationId: params.organizationId } },
    metadata: { organizationId: params.organizationId },
    allow_promotion_codes: true,
  });
  return { url: session.url ?? "" };
}

/** Billing-portal session so a customer can update seats, card, or cancel. */
export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return { url: session.url };
}

/** Fetch a subscription (webhook enrichment). */
export function retrieveSubscription(id: string): Promise<Stripe.Subscription> {
  return stripe().subscriptions.retrieve(id);
}
