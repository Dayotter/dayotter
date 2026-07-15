"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import {
  analyticsConfigured,
  analyticsOptedOut,
  configuredProviders,
  setAnalyticsEnabled,
} from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { useEffect, useState } from "react";

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border px-0.5 transition-colors",
        on
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );
}

/**
 * End-user analytics opt-out. Analytics only exists at all when the deploy has
 * configured a provider; this lets the visitor turn it off in their browser.
 * State lives in localStorage (see lib/analytics), so it's read after mount.
 */
export function AnalyticsPreferences() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => setEnabled(!analyticsOptedOut()), []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setAnalyticsEnabled(next);
  }

  return (
    <Card className="mt-6">
      <CardHeader
        title="Analytics & privacy"
        description="Anonymous product usage that helps improve DayOtter."
      />
      <CardBody>
        {analyticsConfigured ? (
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                Share anonymous product analytics
              </p>
              <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                Sent to {configuredProviders.join(", ")}. Turn this off and nothing is captured from
                this browser. Takes effect immediately.
              </p>
            </div>
            <Switch on={enabled} onClick={toggle} />
          </div>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            Analytics isn't enabled on this DayOtter instance - nothing is being collected. A
            deployer can turn it on by setting a provider key (Mixpanel, Google Analytics, or
            PostHog).
          </p>
        )}
      </CardBody>
    </Card>
  );
}
