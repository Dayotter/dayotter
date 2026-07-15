import { asc, eq, getDb, schema } from "@dayotter/db";
import { isCloud } from "./edition";
import { ALL_FEATURES, type Feature, hasFeature } from "./features";

/** How long past the paid period a `past_due` org keeps Pro before we drop it,
 *  so a failed renewal isn't cut off instantly but also isn't Pro forever. */
const PAST_DUE_GRACE_MS = 7 * 86_400_000;

/** Whether an org's Stripe plan currently entitles it to Pro. `active`/`trialing`
 *  always do; `past_due` does only within a bounded grace window past the paid
 *  period end (an unbounded past_due would otherwise keep Pro indefinitely). */
function planEntitled(org: {
  plan: string | null;
  planStatus: string | null;
  currentPeriodEnd: Date | null;
}): boolean {
  if (org.plan !== "pro") return false;
  const status = org.planStatus ?? "";
  if (status === "active" || status === "trialing") return true;
  if (status === "past_due") {
    // No stored period end → keep Pro (don't cut off blindly). Otherwise drop
    // once we're past the period end plus the grace window.
    if (!org.currentPeriodEnd) return true;
    return org.currentPeriodEnd.getTime() + PAST_DUE_GRACE_MS >= Date.now();
  }
  return false;
}

export interface Entitlements {
  edition: "cloud" | "self-hosted";
  plan: "free" | "pro";
  isCloud: boolean;
  isPro: boolean;
  organizationId: string | null;
  /** Per-feature allow map for the UI to render locks/upgrade prompts. */
  features: Record<Feature, boolean>;
}

/** The user's primary org (oldest membership) - where the plan lives. */
export async function primaryOrg(userId: string) {
  const membership = await getDb().query.memberships.findFirst({
    where: eq(schema.memberships.userId, userId),
    orderBy: asc(schema.memberships.createdAt),
    with: { organization: true },
  });
  return membership?.organization ?? null;
}

/**
 * Resolve what an account can use. On self-host, `isPro` is true (Pro features
 * are free) and cloud-only features stay off. On cloud, `isPro` reflects the
 * org's Stripe subscription.
 */
export async function getEntitlements(userId: string): Promise<Entitlements> {
  const org = isCloud ? await primaryOrg(userId) : null;
  const paid = org ? planEntitled(org) : false;
  const isPro = isCloud ? paid : true;

  const ctx = { isCloud, isPro };
  const features = Object.fromEntries(ALL_FEATURES.map((f) => [f, hasFeature(f, ctx)])) as Record<
    Feature,
    boolean
  >;

  return {
    edition: isCloud ? "cloud" : "self-hosted",
    plan: isPro && isCloud ? "pro" : isCloud ? "free" : "pro",
    isCloud,
    isPro,
    organizationId: org?.id ?? null,
    features,
  };
}

/** True if `userId` may use `feature`. Cheap wrapper over getEntitlements. */
export async function userHasFeature(userId: string, feature: Feature): Promise<boolean> {
  const ent = await getEntitlements(userId);
  return ent.features[feature];
}
