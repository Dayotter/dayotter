import { InsightsTabs } from "@/components/insights-tabs";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { getSession } from "@/lib/auth/session";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { computeInsights } from "@/lib/booking/insights";
import { type Recommendation, getRecommendations } from "@/lib/intelligence/recommendations";
import { CalendarX2, Gauge, Layers, Shield, Sun } from "lucide-react";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const REC_ICON: Record<Recommendation["icon"], typeof Sun> = {
  sun: Sun,
  layers: Layers,
  "calendar-x": CalendarX2,
  gauge: Gauge,
  shield: Shield,
};

/** A minimal SVG progress ring — Planif's signature, honest not vanity. */
function Ring({ value, max, label }: { value: number; max: number; label: string }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="flex flex-col items-center">
      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-border)" strokeWidth="10" />
        <circle
          cx="56"
          cy="56"
          r={r}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <p className="-mt-[68px] text-center text-2xl font-semibold">{value}</p>
      <p className="mt-[44px] text-center text-xs text-[var(--color-muted)]">{label}</p>
    </div>
  );
}

function Stat({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{label}</p>
      {sub ? <p className="mt-0.5 text-xs text-[var(--color-faint)]">{sub}</p> : null}
    </Card>
  );
}

export default async function InsightsPage() {
  const session = await getSession();
  const tz = (session!.user as { timezone?: string }).timezone ?? "UTC";

  const [insights, recommendations] = await Promise.all([
    computeInsights({ userId: session!.user.id, tz }),
    getRecommendations({ userId: session!.user.id, tz }),
  ]);
  const {
    upcomingCount,
    bookedMinutes,
    busiestWeekday,
    avgPerWeek,
    thisWeek,
    weekday,
    byType: types,
    focus,
  } = insights;

  const maxWeekday = Math.max(1, ...weekday);
  const maxTypeMinutes = Math.max(1, ...types.map((t) => t.minutes));
  const hasData = upcomingCount > 0 || weekday.some((n) => n > 0) || thisWeek > 0;

  const fmtHours = (min: number) => {
    const h = min / 60;
    return h >= 10 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Insights"
        description="Where your scheduling time actually goes — the last 30 days."
      />

      <InsightsTabs />

      {!hasData ? (
        <Card className="p-8 text-center text-sm text-[var(--color-muted)]">
          No meetings in the last 30 days yet. Once people start booking, your time insights show up
          here.
        </Card>
      ) : (
        <div className="space-y-6">
          {recommendations.length > 0 ? (
            <Card className="p-5">
              <h3 className="mb-1 text-sm font-semibold">Recommendations</h3>
              <p className="mb-4 text-xs text-[var(--color-faint)]">
                Learned from your last 30 days — suggestions, never rules.
              </p>
              <div className="space-y-3">
                {recommendations.map((r) => {
                  const Icon = REC_ICON[r.icon];
                  return (
                    <div key={r.id} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.title}</p>
                        <p className="text-xs text-[var(--color-muted)]">{r.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={String(upcomingCount)} label="Upcoming" sub="next 30 days" />
            <Stat value={fmtHours(bookedMinutes)} label="Booked" sub="last 30 days" />
            <Stat
              value={busiestWeekday !== null ? WEEKDAYS[busiestWeekday]! : "—"}
              label="Busiest day"
              sub="last 30 days"
            />
            <Stat value={String(avgPerWeek)} label="Meetings / week" sub="30-day average" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Card className="flex flex-col items-center justify-center p-6">
              <Ring value={thisWeek} max={Math.max(avgPerWeek, thisWeek, 1)} label="this week" />
              <p className="mt-3 text-center text-xs text-[var(--color-muted)]">
                {avgPerWeek > 0
                  ? `Your weekly average is ${avgPerWeek}.`
                  : "Building your weekly average."}
              </p>
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 text-sm font-semibold">Meetings by weekday</h3>
              <div className="flex items-end gap-2" style={{ height: 140 }}>
                {weekday.map((count, i) => (
                  <div key={WEEKDAYS[i]} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-sm bg-[var(--color-accent)]"
                        style={{
                          height: `${(count / maxWeekday) * 100}%`,
                          minHeight: count ? 4 : 0,
                        }}
                        title={`${count} meeting${count === 1 ? "" : "s"}`}
                      />
                    </div>
                    <span className="text-xs text-[var(--color-faint)]">{WEEKDAYS[i]}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold">Time by event type</h3>
            {types.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">No completed meetings yet.</p>
            ) : (
              <div className="space-y-3">
                {types.map((t) => (
                  <div key={t.title}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: eventColorVar(t.color) }}
                        />
                        <span className="truncate">{t.title}</span>
                      </span>
                      <span className="shrink-0 text-[var(--color-muted)]">
                        {fmtHours(t.minutes)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(t.minutes / maxTypeMinutes) * 100}%`,
                          backgroundColor: eventColorVar(t.color),
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {focus.busyDays > 0 ? (
            <Card className="p-5">
              <h3 className="mb-1 text-sm font-semibold">Focus &amp; fragmentation</h3>
              <p className="mb-4 text-xs text-[var(--color-faint)]">
                How broken-up your meeting days are — over {focus.busyDays} day
                {focus.busyDays === 1 ? "" : "s"} with meetings.
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  value={String(focus.avgMeetingsPerBusyDay)}
                  label="Meetings / busy day"
                  sub="on days you meet"
                />
                <Stat
                  value={`${focus.fragmentedDaysPct}%`}
                  label="Fragmented days"
                  sub="3+ meetings"
                />
                <Stat
                  value={`${focus.backToBackPct}%`}
                  label="Back-to-back"
                  sub="under 15-min gaps"
                />
                <Stat
                  value={fmtHours(focus.avgLongestGapMin)}
                  label="Longest focus gap"
                  sub="avg on busy days"
                />
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
