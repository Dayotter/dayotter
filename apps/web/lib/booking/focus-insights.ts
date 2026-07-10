import { DateTime } from "luxon";

export interface FocusMetrics {
  /** Local days (in range) that had at least one meeting. */
  busyDays: number;
  /** Average meetings on a day that had any. */
  avgMeetingsPerBusyDay: number;
  /** % of busy days with 3+ meetings (a fragmented day). */
  fragmentedDaysPct: number;
  /** % of consecutive same-day meeting pairs separated by < 15 min (rushed). */
  backToBackPct: number;
  /** Avg (over days with 2+ meetings) of the largest gap between meetings — a
   * proxy for the biggest focus window left on a busy day, in minutes. */
  avgLongestGapMin: number;
}

const RUSHED_GAP_MIN = 15;

/**
 * Focus metrics derived purely from a host's meeting intervals — how fragmented
 * their meeting days are and how much contiguous focus time survives. Groups by
 * local calendar day in `tz`. Pure + deterministic (unit-tested).
 */
export function computeFocusMetrics(
  meetings: { start: Date; end: Date }[],
  tz: string,
): FocusMetrics {
  // Group meeting [startMs,endMs] by local day.
  const byDay = new Map<string, { start: number; end: number }[]>();
  for (const m of meetings) {
    const day = DateTime.fromJSDate(m.start).setZone(tz).toISODate() ?? "";
    const list = byDay.get(day) ?? [];
    list.push({ start: m.start.getTime(), end: m.end.getTime() });
    byDay.set(day, list);
  }

  const busyDays = byDay.size;
  if (busyDays === 0) {
    return {
      busyDays: 0,
      avgMeetingsPerBusyDay: 0,
      fragmentedDaysPct: 0,
      backToBackPct: 0,
      avgLongestGapMin: 0,
    };
  }

  let totalMeetings = 0;
  let fragmentedDays = 0;
  let pairs = 0;
  let rushedPairs = 0;
  const longestGaps: number[] = [];

  for (const list of byDay.values()) {
    list.sort((a, b) => a.start - b.start);
    totalMeetings += list.length;
    if (list.length >= 3) fragmentedDays++;

    let dayLongestGap = 0;
    for (let i = 1; i < list.length; i++) {
      const cur = list[i];
      const prev = list[i - 1];
      if (!cur || !prev) continue;
      pairs++;
      const gapMin = (cur.start - prev.end) / 60_000;
      if (gapMin < RUSHED_GAP_MIN) rushedPairs++;
      if (gapMin > dayLongestGap) dayLongestGap = gapMin;
    }
    if (list.length >= 2) longestGaps.push(dayLongestGap);
  }

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
  return {
    busyDays,
    avgMeetingsPerBusyDay: Math.round((totalMeetings / busyDays) * 10) / 10,
    fragmentedDaysPct: Math.round((fragmentedDays / busyDays) * 100),
    backToBackPct: pairs ? Math.round((rushedPairs / pairs) * 100) : 0,
    avgLongestGapMin: Math.round(avg(longestGaps)),
  };
}
