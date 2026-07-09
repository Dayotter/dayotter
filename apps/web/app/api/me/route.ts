import { aiEnabled } from "@/lib/ai/llm";
import { getEntitlements } from "@/lib/billing/entitlements";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Current user + profile + server capabilities + plan entitlements. */
export const GET = withUser(async (u) => {
  const [user, entitlements] = await Promise.all([
    getDb().query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { id: true, name: true, email: true, image: true, handle: true, timezone: true },
    }),
    getEntitlements(u.id),
  ]);
  if (!user) return jsonError("Not found", 404);
  return NextResponse.json({ user, aiEnabled, paymentsEnabled, entitlements });
});
