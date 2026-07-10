import { NextResponse } from "next/server";
import { userHasFeature } from "./entitlements";
import { FEATURE_LABEL, type Feature } from "./features";

/**
 * Gate a route behind an entitlement. Returns a 402 (Payment Required) response
 * when the caller isn't entitled, or `null` to proceed. On self-host this always
 * returns null (Pro features are free); it only bites on cloud + free.
 *
 *   const gate = await requireFeature(u.id, "automation");
 *   if (gate) return gate;
 */
export async function requireFeature(
  userId: string,
  feature: Feature,
): Promise<NextResponse | null> {
  if (await userHasFeature(userId, feature)) return null;
  return NextResponse.json(
    {
      error: `${FEATURE_LABEL[feature]} is a Pro feature. Upgrade to unlock it.`,
      upgrade: true,
      feature,
    },
    { status: 402 },
  );
}
