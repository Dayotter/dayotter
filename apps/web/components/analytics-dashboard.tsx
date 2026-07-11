"use client";

import { Card, CardBody } from "@/components/ui/card";
import type { AnalyticsData } from "@/lib/booking/analytics";
import { formatMoney } from "@/lib/booking/money";
import { Download } from "lucide-react";
import { useEffect, useState } from "react";

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

function pct(n: number): string {
  return `${(n * 100).toFixed(n >= 0.1 ? 0 : 1)}%`;
}

export function AnalyticsDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/api/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => active && setData(d.analytics))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [days]);

  const t = data?.totals;
  const revenue = t && t.revenueCents > 0 && data?.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[var(--color-border-strong)] p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setDays(r.days)}
              className={
                r.days === days
                  ? "rounded px-3 py-1.5 text-sm bg-[var(--color-accent)] text-white"
                  : "rounded px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <a
          href={`/api/analytics/export?days=${days}`}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
        >
          <Download size={15} /> Export CSV
        </a>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Page views" value={t?.views ?? 0} />
        <Stat label="Unique visitors" value={t?.uniqueVisitors ?? 0} />
        <Stat label="Bookings" value={t?.confirmed ?? 0} hint="confirmed" />
        <Stat label="Conversion" value={t ? pct(t.conversionRate) : "—"} hint="visitor → booking" />
      </div>

      {revenue ? (
        <Card>
          <CardBody className="flex items-baseline justify-between p-5">
            <span className="text-sm text-[var(--color-muted)]">Revenue collected</span>
            <span className="text-xl font-semibold">
              {formatMoney(t.revenueCents, data.currency ?? "usd")}
            </span>
          </CardBody>
        </Card>
      ) : null}

      {/* Funnel */}
      {t ? (
        <Card>
          <CardBody className="space-y-3 p-5">
            <h2 className="text-sm font-semibold">Funnel</h2>
            <FunnelBar label="Visitors" value={t.uniqueVisitors} max={t.uniqueVisitors} />
            {t.checkoutStarted > 0 ? (
              <FunnelBar
                label="Checkout started"
                value={t.checkoutStarted}
                max={t.uniqueVisitors}
              />
            ) : null}
            <FunnelBar label="Bookings made" value={t.bookings} max={t.uniqueVisitors} />
            <FunnelBar label="Confirmed" value={t.confirmed} max={t.uniqueVisitors} />
            <FunnelBar label="Completed" value={t.completed} max={t.uniqueVisitors} muted />
            <div className="flex gap-4 pt-1 text-xs text-[var(--color-faint)]">
              <span>Cancelled: {t.cancelled}</span>
              <span>No-shows: {t.noShow}</span>
            </div>
          </CardBody>
        </Card>
      ) : null}

      {/* Per event type */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-faint)]">
                  <th className="px-4 py-3 font-medium">Event type</th>
                  <th className="px-4 py-3 text-right font-medium">Views</th>
                  <th className="px-4 py-3 text-right font-medium">Visitors</th>
                  <th className="px-4 py-3 text-right font-medium">Booked</th>
                  <th className="px-4 py-3 text-right font-medium">Conv.</th>
                  <th className="px-4 py-3 text-right font-medium">Cancel</th>
                  <th className="px-4 py-3 text-right font-medium">No-show</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted)]">
                      Loading…
                    </td>
                  </tr>
                ) : !data || data.byEventType.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-[var(--color-muted)]">
                      No event types yet.
                    </td>
                  </tr>
                ) : (
                  data.byEventType.map((r) => (
                    <tr key={r.eventTypeId} className="border-b border-[var(--color-border)]">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {r.color ? (
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: r.color }}
                            />
                          ) : null}
                          {r.title}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.views}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.uniqueVisitors}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.confirmed}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{pct(r.conversionRate)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {r.cancelled}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-[var(--color-muted)]">
                        {r.noShow}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.revenueCents > 0
                          ? formatMoney(r.revenueCents, r.currency ?? "usd")
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardBody className="p-4">
        <p className="text-xs text-[var(--color-muted)]">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? <p className="text-xs text-[var(--color-faint)]">{hint}</p> : null}
      </CardBody>
    </Card>
  );
}

function FunnelBar({
  label,
  value,
  max,
  muted,
}: {
  label: string;
  value: number;
  max: number;
  muted?: boolean;
}) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-[var(--color-muted)]">{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            backgroundColor: muted ? "var(--color-border-strong)" : "var(--color-accent)",
          }}
        />
      </div>
    </div>
  );
}
