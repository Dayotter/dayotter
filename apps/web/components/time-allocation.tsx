"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { useEffect, useState } from "react";

interface StatResult {
  key: string;
  kind: "stat";
  label: string;
  value: string;
  hint?: string;
}
interface BreakdownResult {
  key: string;
  kind: "breakdown";
  label: string;
  items: { label: string; minutes: number; color?: string | null }[];
}
type MetricResult = StatResult | BreakdownResult;

function hoursLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function Breakdown({ metric }: { metric: BreakdownResult }) {
  const max = Math.max(1, ...metric.items.map((i) => i.minutes));
  return (
    <div>
      <p className="text-sm font-medium">{metric.label}</p>
      <div className="mt-3 space-y-2">
        {metric.items.map((it) => (
          <div key={it.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-[var(--color-muted)]">
              {it.label}
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(3, (it.minutes / max) * 100)}%`,
                  background: it.color ?? "var(--color-accent)",
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[var(--color-faint)]">
              {hoursLabel(it.minutes)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * "Where your time goes" - renders the time-allocation metrics generically, so
 * any new metric (lib/analytics/time-allocation) shows up with no UI change.
 */
export function TimeAllocation() {
  const [data, setData] = useState<{ windowDays: number; metrics: MetricResult[] } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/insights/time")
      .then((r) => r.json())
      .then((d) => active && setData(d))
      .catch(() => active && setData({ windowDays: 30, metrics: [] }));
    return () => {
      active = false;
    };
  }, []);

  if (!data || data.metrics.length === 0) return null;

  const stats = data.metrics.filter((m): m is StatResult => m.kind === "stat");
  const breakdowns = data.metrics.filter((m): m is BreakdownResult => m.kind === "breakdown");

  return (
    <Card className="mb-6">
      <CardHeader title="Where your time goes" description={`Your last ${data.windowDays} days.`} />
      <CardBody className="space-y-6">
        {stats.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.key} className="rounded-md border border-[var(--color-border)] px-4 py-3">
                <p className="text-xs text-[var(--color-muted)]">{s.label}</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{s.value}</p>
                {s.hint ? (
                  <p className="mt-0.5 text-xs text-[var(--color-faint)]">{s.hint}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
        {breakdowns.map((b) => (
          <Breakdown key={b.key} metric={b} />
        ))}
      </CardBody>
    </Card>
  );
}
