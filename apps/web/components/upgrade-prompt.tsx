"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FEATURE_LABEL, type Feature } from "@/lib/billing/features";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface FeatureState {
  loading: boolean;
  allowed: boolean;
}

/**
 * Whether the current account may use `feature`. Reads `/api/me` entitlements.
 * Fails OPEN (allowed) on any error so a hiccup never paywalls a self-hoster.
 */
export function useFeature(feature: Feature): FeatureState {
  const [state, setState] = useState<FeatureState>({ loading: true, allowed: true });
  useEffect(() => {
    let active = true;
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (active)
          setState({ loading: false, allowed: d.entitlements?.features?.[feature] ?? true });
      })
      .catch(() => active && setState({ loading: false, allowed: true }));
    return () => {
      active = false;
    };
  }, [feature]);
  return state;
}

/** A friendly paywall card shown in place of a Pro feature on the free plan. */
export function UpgradePrompt({ feature }: { feature: Feature }) {
  return (
    <Card className="mx-auto max-w-md">
      <CardBody className="flex flex-col items-center gap-3 p-8 text-center">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
          <Lock size={18} className="text-[var(--color-accent)]" />
        </div>
        <h2 className="text-lg font-semibold">{FEATURE_LABEL[feature]} is a Pro feature</h2>
        <p className="text-sm text-[var(--color-muted)]">
          Upgrade to Pro ($9/seat/mo) to unlock {FEATURE_LABEL[feature].toLowerCase()} and every
          other dayotter differentiator.
        </p>
        <Link href="/settings/billing" className="mt-1">
          <Button>Upgrade to Pro</Button>
        </Link>
      </CardBody>
    </Card>
  );
}

/**
 * Gate a client subtree behind an entitlement: renders the paywall when the
 * account isn't entitled, the children otherwise. On self-host everything is
 * entitled, so this is transparent.
 */
export function ProGate({ feature, children }: { feature: Feature; children: React.ReactNode }) {
  const { loading, allowed } = useFeature(feature);
  if (loading) return null;
  if (!allowed) return <UpgradePrompt feature={feature} />;
  return <>{children}</>;
}
