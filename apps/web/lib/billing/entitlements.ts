import { asc, eq, getDb, schema } from "@dayotter/db";
import { isCloud } from "./edition";
import { ALL_FEATURES, type Feature, hasFeature } from "./features";

/** Stripe subscription statuses that count as "paying / entitled". */
const ACTIVE = new Set(["active", "trialing", "past_due"]);

export interface Entitlements {
  edition: "cloud" | "self-hosted";
  plan: "free" | "pro";
  isCloud: boolean;
  isPro: boolean;
  organizationId: string | null;
  /** Per-feature allow map for the UI to render locks/upgrade prompts. */
  features: Record<Feature, boolean>;
}

/** The user's primary org (oldest membership) — where the plan lives. */
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
  const paid = org?.plan === "pro" && ACTIVE.has(org.planStatus ?? "");
  const isPro = isCloud ? Boolean(paid) : true;

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
