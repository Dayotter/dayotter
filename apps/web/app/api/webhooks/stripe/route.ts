import { fulfillCheckout } from "@/lib/payments/fulfill";
import { constructWebhookEvent, paymentsEnabled } from "@/lib/payments/stripe";
import { logger } from "@calsync/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stripe webhook — the reliable backstop that confirms a paid booking even if
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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as { id: string };
    try {
      await fulfillCheckout(session.id);
    } catch (err) {
      logger.error("stripe webhook fulfill failed", {
        event: "stripe_webhook_fulfill_failed",
        err,
      });
      // Return 200 anyway so Stripe doesn't retry a booking we already refunded.
    }
  }

  return NextResponse.json({ received: true });
}
