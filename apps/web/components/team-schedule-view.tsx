import type { MemberSchedule } from "@/lib/booking/team-schedule";
import { DateTime } from "luxon";

const DAYS = 7;

/**
 * Shared team calendar — a 7-day grid (members × days) showing when each member
 * is busy, rendered in the viewer's timezone. Read-only; horizontally scrollable
 * on small screens. This is the "see everyone's schedule" wedge view.
 */
export function TeamScheduleView({
  schedule,
  timezone,
  rangeStart,
}: {
  schedule: MemberSchedule[];
  timezone: string;
  rangeStart: Date;
}) {
  const start = DateTime.fromJSDate(rangeStart).setZone(timezone).startOf("day");
  const days = Array.from({ length: DAYS }, (_, i) => start.plus({ days: i }));
  const today = DateTime.now().setZone(timezone).startOf("day");

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-2 text-left text-xs font-medium text-[var(--color-muted)]">
              Member
            </th>
            {days.map((d) => {
              const isToday = d.hasSame(today, "day");
              return (
                <th
                  key={d.toISODate()}
                  className={`px-2 py-2 text-center text-xs font-medium ${
                    isToday ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
                  }`}
                >
                  <div>{d.toFormat("ccc")}</div>
                  <div className="text-[13px] text-[var(--color-text)]">{d.toFormat("d")}</div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {schedule.map((member) => (
            <tr key={member.userId} className="border-t border-[var(--color-border)] align-top">
              <td className="sticky left-0 z-10 bg-[var(--color-surface)] px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[11px] font-semibold text-white">
                    {(member.name || member.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-[13px] font-medium">
                    {member.name || member.email}
                  </span>
                </div>
              </td>
              {days.map((d) => {
                const dayStart = d;
                const dayEnd = d.endOf("day");
                const blocks = member.intervals.filter((iv) => {
                  const s = DateTime.fromJSDate(iv.start).setZone(timezone);
                  const e = DateTime.fromJSDate(iv.end).setZone(timezone);
                  return s <= dayEnd && e >= dayStart;
                });
                return (
                  <td key={d.toISODate()} className="px-2 py-3">
                    {blocks.length === 0 ? (
                      <span className="text-xs text-[var(--color-faint)]">—</span>
                    ) : (
                      <div className="space-y-1">
                        {blocks.slice(0, 4).map((iv, i) => (
                          <div
                            key={i}
                            title={iv.title ?? "Busy"}
                            className="truncate rounded-sm bg-[var(--color-accent-soft)] px-1.5 py-1 text-[11px] leading-tight text-[var(--color-accent)]"
                          >
                            {DateTime.fromJSDate(iv.start).setZone(timezone).toFormat("h:mm a")}
                          </div>
                        ))}
                        {blocks.length > 4 ? (
                          <div className="px-1.5 text-[11px] text-[var(--color-faint)]">
                            +{blocks.length - 4} more
                          </div>
                        ) : null}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
