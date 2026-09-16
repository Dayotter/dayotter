import { fulfillCheckout } from "@/lib/payments/fulfill";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { env } from "@/lib/server/env";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Stripe redirects the booker here after paying. We confirm the payment, create
 *  the booking (idempotent with the webhook), and send them to the confirmation. */
export async function GET(request: Request) {
  const appUrl = env.APP_URL;
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!paymentsEnabled || !sessionId) return NextResponse.redirect(`${appUrl}/`);

  try {
    const { uid, pending } = await fulfillCheckout(sessionId);
    if (uid) return NextResponse.redirect(`${appUrl}/booking/${uid}`);
    // Payment succeeded but the booking row isn't ready yet (webhook mid-flight).
    return NextResponse.redirect(`${appUrl}/booking/processing`);
    // (unreachable branch kept intentionally simple)
  } catch (err) {
    logger.error("payment success handler failed", { event: "payment_success_failed", err });
    return NextResponse.redirect(`${appUrl}/booking/payment-failed`);
  }
}
