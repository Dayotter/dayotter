import { aiEnabled } from "@/lib/ai/llm";
import { getEntitlements } from "@/lib/billing/entitlements";
import { paymentsEnabled } from "@/lib/payments/stripe";
import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Current user + profile + server capabilities + plan entitlements. */
export const GET = withUser(async (u) => {
  const [user, prefs, entitlements] = await Promise.all([
    getDb().query.users.findFirst({
      where: eq(schema.users.id, u.id),
      columns: { id: true, name: true, email: true, image: true, handle: true, timezone: true },
    }),
    getDb().query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, u.id),
      columns: { brandColor: true, welcomeMessage: true },
    }),
    getEntitlements(u.id),
  ]);
  if (!user) return jsonError("Not found", 404);
  const branding = {
    brandColor: prefs?.brandColor ?? null,
    welcomeMessage: prefs?.welcomeMessage ?? null,
  };
  return NextResponse.json({ user, branding, aiEnabled, paymentsEnabled, entitlements });
});
