import { BillingActions } from "@/components/billing-actions";
import { PageHeader } from "@/components/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { PRO_PRICE_USD, isCloud } from "@/lib/billing/edition";
import { getEntitlements, primaryOrg } from "@/lib/billing/entitlements";
import { FEATURE_LABEL, FEATURE_TIER, type Feature } from "@/lib/billing/features";
import { seatCount } from "@/lib/billing/subscription";
import { subscriptionsEnabled } from "@/lib/payments/stripe";
import { Check, Heart } from "lucide-react";

export const dynamic = "force-dynamic";

const PRO_FEATURES = (Object.keys(FEATURE_TIER) as Feature[]).filter(
  (f) => FEATURE_TIER[f] === "pro",
);

function FeatureList() {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {PRO_FEATURES.map((f) => (
        <li key={f} className="flex items-center gap-2 text-sm">
          <Check size={15} className="text-[var(--color-accent)]" />
          {FEATURE_LABEL[f]}
        </li>
      ))}
    </ul>
  );
}

export default async function BillingPage() {
  const session = await getSession();
  const userId = session!.user!.id;

  // Self-hosted: no billing — everything is unlocked.
  if (!isCloud) {
    return (
      <div>
        <PageHeader title="Billing" description="Your DayOtter edition and plan." />
        <Card className="max-w-2xl">
          <CardBody className="space-y-4 p-6">
            <div className="flex items-center gap-2 font-medium">
              <Heart size={16} className="text-[var(--color-accent)]" /> Self-hosted — everything
              unlocked
            </div>
            <p className="text-sm text-[var(--color-muted)]">
              You're running the open-source edition. Every Pro feature is free, forever. No
              subscription needed.
            </p>
            <FeatureList />
          </CardBody>
        </Card>
      </div>
    );
  }

  const [ent, org] = await Promise.all([getEntitlements(userId), primaryOrg(userId)]);
  const seats = org ? await seatCount(org.id) : 1;
  const renews = org?.currentPeriodEnd
    ? new Date(org.currentPeriodEnd).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;

  return (
    <div>
      <PageHeader title="Billing" description="Manage your DayOtter plan." />
      <Card className="max-w-2xl">
        <CardBody className="space-y-5 p-6">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-faint)]">
                Current plan
              </p>
              <p className="text-xl font-semibold">{ent.plan === "pro" ? "Pro" : "Free"}</p>
            </div>
            {ent.plan === "pro" ? (
              <p className="text-sm text-[var(--color-muted)]">
                {seats} seat{seats === 1 ? "" : "s"} · ${PRO_PRICE_USD}/seat/mo
                {renews ? ` · renews ${renews}` : ""}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-muted)]">
                ${PRO_PRICE_USD}/seat/mo unlocks everything below
              </p>
            )}
          </div>

          <FeatureList />

          {subscriptionsEnabled ? (
            <BillingActions plan={ent.plan} />
          ) : (
            <p className="text-sm text-[var(--color-faint)]">
              Billing isn't configured on this server yet.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
