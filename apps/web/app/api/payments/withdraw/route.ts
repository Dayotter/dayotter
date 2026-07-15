import { WITHDRAW_MINIMUM, connectedBalance, createConnectedPayout } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Withdraw the host's available balance to their bank - manual payout, gated at
 *  the $100 minimum. */
export const POST = withUser(async (u) => {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { stripeAccountId: true, stripePayoutsEnabled: true },
  });
  if (!user?.stripeAccountId || !user.stripePayoutsEnabled) {
    return jsonError("Connect payouts before withdrawing.", 400);
  }

  try {
    const { available, currency } = await connectedBalance(user.stripeAccountId);
    if (available < WITHDRAW_MINIMUM) {
      return jsonError("You need at least $100 available to withdraw.", 400);
    }
    await createConnectedPayout(user.stripeAccountId, available, currency);
    return NextResponse.json({ ok: true, amount: available, currency });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error("stripe payout failed", { event: "payout_failed", userId: u.id, err });
    return NextResponse.json({ error: "Couldn't start the withdrawal.", detail }, { status: 500 });
  }
});
