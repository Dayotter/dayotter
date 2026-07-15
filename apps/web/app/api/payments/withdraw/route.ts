import { WITHDRAW_MINIMUM, connectedBalances, createConnectedPayout } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { connection } from "@dayotter/jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Withdraw the host's available balance to their bank - manual payout, gated at
 *  the minimum. Pays out EVERY currency bucket that clears the minimum, so a host
 *  taking multiple currencies isn't left with stranded funds. */
export const POST = withUser(async (u) => {
  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { stripeAccountId: true, stripePayoutsEnabled: true },
  });
  if (!user?.stripeAccountId || !user.stripePayoutsEnabled) {
    return jsonError("Connect payouts before withdrawing.", 400);
  }

  // Short per-host lock so a double-click can't fire two concurrent withdrawals.
  const lockKey = `dayotter:withdraw:lock:${u.id}`;
  const locked = await connection.set(lockKey, "1", "EX", 30, "NX").catch(() => "OK");
  if (locked !== "OK") return jsonError("A withdrawal is already in progress.", 409);

  try {
    const balances = await connectedBalances(user.stripeAccountId);
    const withdrawable = balances.filter((b) => b.available >= WITHDRAW_MINIMUM);
    if (withdrawable.length === 0) {
      return jsonError("You need at least the minimum available to withdraw.", 400);
    }

    const payouts: { amount: number; currency: string }[] = [];
    for (const b of withdrawable) {
      // Idempotency key ties the payout to this exact intent for a short window,
      // so a retried request within the minute won't create a second payout.
      const bucket = Math.floor(Date.now() / 60_000);
      const idempotencyKey = `withdraw:${user.stripeAccountId}:${b.currency}:${b.available}:${bucket}`;
      await createConnectedPayout(user.stripeAccountId, b.available, b.currency, idempotencyKey);
      payouts.push({ amount: b.available, currency: b.currency });
    }
    return NextResponse.json({ ok: true, payouts });
  } catch (err) {
    // Log the Stripe detail server-side only - never return it to the client.
    logger.error("stripe payout failed", { event: "payout_failed", userId: u.id, err });
    return NextResponse.json({ error: "Couldn't start the withdrawal." }, { status: 500 });
  } finally {
    await connection.del(lockKey).catch(() => {});
  }
});
