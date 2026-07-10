import { logger } from "@calsync/core";
import { eq, getDb, schema, sql } from "@calsync/db";
import type Stripe from "stripe";
import { retrieveSubscription } from "../payments/stripe";

/** Current seat count for an org = number of members. */
export async function seatCount(organizationId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.memberships)
    .where(eq(schema.memberships.organizationId, organizationId));
  return Math.max(1, row?.n ?? 1);
}

/**
 * Mirror a Stripe subscription onto the org's plan columns. Called from the
 * webhook (source of truth) and after checkout. A cancelled/incomplete
 * subscription drops the org back to `free`.
 */
export async function syncOrgSubscription(sub: Stripe.Subscription): Promise<void> {
  const organizationId = sub.metadata?.organizationId;
  if (!organizationId) {
    logger.warn("subscription has no organizationId", {
      event: "billing_sub_no_org",
      subscriptionId: sub.id,
    });
    return;
  }

  const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const quantity = sub.items?.data?.[0]?.quantity ?? 1;
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

  await getDb()
    .update(schema.organizations)
    .set({
      plan: active ? "pro" : "free",
      planStatus: sub.status,
      planSeats: quantity,
      currentPeriodEnd: periodEnd,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    })
    .where(eq(schema.organizations.id, organizationId));

  logger.info("org plan synced", {
    event: "billing_plan_synced",
    organizationId,
    plan: active ? "pro" : "free",
    status: sub.status,
    seats: quantity,
  });
}

/** Resolve a subscription id → object → sync (webhook events carry only the id sometimes). */
export async function syncSubscriptionById(subscriptionId: string): Promise<void> {
  const sub = await retrieveSubscription(subscriptionId);
  await syncOrgSubscription(sub);
}
