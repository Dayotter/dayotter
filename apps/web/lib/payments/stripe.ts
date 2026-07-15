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
  /** Host's Stripe Connect account - when set, funds are routed there (a
   * destination charge) minus the platform fee, instead of staying on the platform. */
  destinationAccountId?: string;
}

/** Create a one-off Checkout Session and return its hosted URL + id. */
export async function createCheckoutSession(
  params: CheckoutParams,
): Promise<{ id: string; url: string }> {
  const dest = params.destinationAccountId;
  const fee = dest ? platformFee(params.amount) : 0;
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
    payment_intent_data: {
      metadata: params.metadata,
      // Destination charge: money lands on the host's connected account; the
      // platform keeps `application_fee_amount`. Refunds reverse both.
      ...(dest
        ? {
            transfer_data: { destination: dest },
            ...(fee > 0 ? { application_fee_amount: fee } : {}),
          }
        : {}),
    },
  });
  return { id: session.id, url: session.url ?? "" };
}

/** Retrieve a session (used by the success handler to confirm payment). */
export function retrieveSession(id: string): Promise<Stripe.Checkout.Session> {
  return stripe().checkout.sessions.retrieve(id);
}

/** Refund a captured payment (best-effort). Returns true on success. For a
 *  destination charge (funds sent to a host's connected account) pass
 *  `reverseTransfer` so the host's balance is debited too. */
export async function refundPayment(
  paymentIntentId: string,
  reverseTransfer = false,
): Promise<boolean> {
  try {
    await stripe().refunds.create({
      payment_intent: paymentIntentId,
      ...(reverseTransfer ? { reverse_transfer: true, refund_application_fee: true } : {}),
    });
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

// ---- Stripe Connect (Express) - hosts get paid directly ----

/** Connect works whenever the platform Stripe key is set (Connect is enabled on
 *  the platform account in the Stripe Dashboard). */
export const connectEnabled = paymentsEnabled;

/** Platform's percentage cut on each host transaction (0 = none). Env-configurable. */
export const platformFeePercent = Math.max(
  0,
  Math.min(100, Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "0") || 0),
);

/** Minimum balance (minor units) a host can withdraw - $100. */
export const WITHDRAW_MINIMUM = 10_000;

/** The platform fee (minor units) for a charge of `amount`. */
export function platformFee(amount: number): number {
  return Math.round((amount * platformFeePercent) / 100);
}

/** Create an Express connected account for a host, with MANUAL payouts (so the
 *  host withdraws deliberately once they hit the minimum, per product design). */
export async function createConnectAccount(email?: string): Promise<string> {
  const account = await stripe().accounts.create({
    type: "express",
    ...(email ? { email } : {}),
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    settings: { payouts: { schedule: { interval: "manual" } } },
  });
  return account.id;
}

/** Hosted onboarding link for an Express account. */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Login link to the Express dashboard (view payouts history, update bank). */
export async function createExpressLoginLink(accountId: string): Promise<string> {
  const link = await stripe().accounts.createLoginLink(accountId);
  return link.url;
}

export interface ConnectStatus {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

/** Current capability status of a connected account (drives the settings UI). */
export async function retrieveConnectStatus(accountId: string): Promise<ConnectStatus> {
  const a = await stripe().accounts.retrieve(accountId);
  return {
    chargesEnabled: Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
  };
}

export interface CurrencyBalance {
  currency: string;
  /** Minor units clear to withdraw now. */
  available: number;
  /** Minor units still in Stripe's hold period ("on the way"). */
  pending: number;
}

/** Balances on a host's connected account, one entry per currency they hold.
 *  A host taking payments in multiple currencies has a bucket for each - we must
 *  not collapse to `available[0]` or other-currency funds get stranded. */
export async function connectedBalances(accountId: string): Promise<CurrencyBalance[]> {
  const bal = await stripe().balance.retrieve({ stripeAccount: accountId });
  const byCurrency = new Map<string, CurrencyBalance>();
  for (const a of bal.available) {
    const e = byCurrency.get(a.currency) ?? { currency: a.currency, available: 0, pending: 0 };
    e.available += a.amount;
    byCurrency.set(a.currency, e);
  }
  for (const p of bal.pending) {
    const e = byCurrency.get(p.currency) ?? { currency: p.currency, available: 0, pending: 0 };
    e.pending += p.amount;
    byCurrency.set(p.currency, e);
  }
  return [...byCurrency.values()];
}

/** Pay out a host's balance to their bank (manual payout). `idempotencyKey`
 *  guards against a double-submit creating two payouts for the same intent. */
export async function createConnectedPayout(
  accountId: string,
  amount: number,
  currency: string,
  idempotencyKey?: string,
): Promise<{ id: string }> {
  const payout = await stripe().payouts.create(
    { amount, currency },
    { stripeAccount: accountId, ...(idempotencyKey ? { idempotencyKey } : {}) },
  );
  return { id: payout.id };
}
