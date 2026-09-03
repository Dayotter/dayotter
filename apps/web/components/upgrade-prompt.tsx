"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FEATURE_LABEL, type Feature } from "@/lib/billing/features";
import { Lock, Sparkles } from "lucide-react";
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

/** A friendly standalone paywall card (used where there's nothing to preview). */
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
          other DayOtter differentiator.
        </p>
        <Link href="/settings/billing" className="mt-1">
          <Button>Upgrade to Pro</Button>
        </Link>
      </CardBody>
    </Card>
  );
}

/** Compact upgrade card overlaid on a blurred feature preview. */
function UpgradeOverlay({ feature }: { feature: Feature }) {
  const label = FEATURE_LABEL[feature];
  return (
    <Card className="max-w-sm shadow-[var(--shadow-card)]">
      <CardBody className="flex flex-col items-center gap-2.5 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-accent)]/10">
          <Sparkles size={17} className="text-[var(--color-accent)]" />
        </div>
        <h2 className="text-base font-semibold">This is what {label} looks like</h2>
        <p className="text-sm text-[var(--color-muted)]">
          It's a Pro feature. Upgrade ($9/seat/mo) to turn on {label.toLowerCase()} and every other
          DayOtter differentiator.
        </p>
        <Link href="/settings/billing" className="mt-1">
          <Button size="sm">Upgrade to Pro</Button>
        </Link>
      </CardBody>
    </Card>
  );
}

/**
 * Gate a client subtree behind an entitlement. Entitled (incl. every self-host
 * account): render the children normally. Not entitled: show the real feature as
 * a **blurred, non-interactive preview** with an inviting upgrade card on top -
 * so the free plan sees what it's missing instead of a bare "locked" wall. Pass
 * `plain` for the standalone card where a preview would be empty or misleading.
 */
export function ProGate({
  feature,
  children,
  plain = false,
}: {
  feature: Feature;
  children: React.ReactNode;
  plain?: boolean;
}) {
  const { loading, allowed } = useFeature(feature);
  if (loading) return null;
  if (allowed) return <>{children}</>;
  if (plain) return <UpgradePrompt feature={feature} />;
  return (
    <div className="relative isolate overflow-hidden rounded-lg">
      {/* The real feature, rendered as a dead preview behind the upgrade card. */}
      <div
        aria-hidden
        className="pointer-events-none max-h-[560px] select-none overflow-hidden opacity-50 blur-[2px]"
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center bg-gradient-to-b from-transparent via-[var(--color-bg)]/70 to-[var(--color-bg)] px-6 pt-16">
        <UpgradeOverlay feature={feature} />
      </div>
    </div>
  );
}

/**
 * Inline soft-gate for a single control that lives INSIDE a larger form (a
 * toggle, a field, a small block) - where a full blurred-preview card would be
 * too heavy. Entitled (incl. every self-host account): renders the control
 * normally. Not entitled: shows it dimmed and non-interactive with a one-line
 * "this is Pro, upgrade" note beneath, so a cloud free plan sees the option
 * exists instead of it silently 402-ing (or saving nothing) on submit.
 */
export function ProLock({
  feature,
  children,
  note,
}: {
  feature: Feature;
  children: React.ReactNode;
  note?: string;
}) {
  const { loading, allowed } = useFeature(feature);
  if (loading || allowed) return <>{children}</>;
  return (
    <div>
      <div aria-hidden className="pointer-events-none select-none opacity-55">
        {children}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
        <Sparkles size={13} className="shrink-0 text-[var(--color-accent)]" />
        <span>
          {note ?? `${FEATURE_LABEL[feature]} is a Pro feature.`}{" "}
          <Link
            href="/settings/billing"
            className="font-medium text-[var(--color-accent)] hover:underline"
          >
            Upgrade to Pro
          </Link>
        </span>
      </p>
    </div>
  );
}
