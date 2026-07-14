import { DateTime } from "luxon";
import type { MetricResult, TimeDataset, TimeMetric } from "./types";

const minutes = (b: { start: Date; end: Date }) => (b.end.getTime() - b.start.getTime()) / 60_000;
const sum = (arr: { start: Date; end: Date }[]) => arr.reduce((s, b) => s + minutes(b), 0);

/** Human duration for a stat value, e.g. "1h 45m" / "50m". */
function fmtDuration(mins: number): string {
  const m = Math.round(mins);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

/** Domain of an email, lowercased; null when malformed. */
function domainOf(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const d = email
    .slice(at + 1)
    .toLowerCase()
    .trim();
  return d || null;
}

/**
 * The "where your time goes" metrics. Each reads the shared dataset and returns
 * one card, or null when there isn't enough to say. To add an insight, append a
 * TimeMetric here - the API and UI pick it up automatically.
 */
export const METRICS: TimeMetric[] = [
  // Meeting time vs. focus time held - the core balance.
  {
    key: "meeting_focus_balance",
    compute(d: TimeDataset): MetricResult | null {
      const meetingMin = sum(d.bookings);
      const focusMin = sum(d.focusBlocks);
      if (meetingMin + focusMin === 0) return null;
      return {
        key: "meeting_focus_balance",
        kind: "breakdown",
        label: "Meetings vs. focus",
        items: [
          { label: "In meetings", minutes: meetingMin, color: "var(--color-accent)" },
          { label: "Focus held", minutes: focusMin, color: "var(--color-mint)" },
        ],
      };
    },
  },

  // Who you spend the most time with.
  {
    key: "top_people",
    compute(d: TimeDataset): MetricResult | null {
      const byPerson = new Map<string, { label: string; minutes: number }>();
      for (const b of d.bookings) {
        const mins = minutes(b);
        for (const a of b.attendees) {
          const key = a.email.toLowerCase();
          const cur = byPerson.get(key) ?? { label: a.name || a.email, minutes: 0 };
          cur.minutes += mins;
          byPerson.set(key, cur);
        }
      }
      const items = [...byPerson.values()].sort((a, b) => b.minutes - a.minutes).slice(0, 5);
      if (items.length === 0) return null;
      return { key: "top_people", kind: "breakdown", label: "Who you spend time with", items };
    },
  },

  // When in the day your meetings land.
  {
    key: "time_of_day",
    compute(d: TimeDataset): MetricResult | null {
      if (d.bookings.length === 0) return null;
      const buckets = { Morning: 0, Afternoon: 0, Evening: 0 };
      for (const b of d.bookings) {
        const h = DateTime.fromJSDate(b.start).setZone(d.tz).hour;
        const mins = minutes(b);
        if (h < 12) buckets.Morning += mins;
        else if (h < 17) buckets.Afternoon += mins;
        else buckets.Evening += mins;
      }
      return {
        key: "time_of_day",
        kind: "breakdown",
        label: "Meetings by time of day",
        items: Object.entries(buckets).map(([label, m]) => ({ label, minutes: m })),
      };
    },
  },

  // Weekly meeting load as a headline number.
  {
    key: "weekly_load",
    compute(d: TimeDataset): MetricResult | null {
      if (d.bookings.length === 0) return null;
      const hoursPerWeek = (sum(d.bookings) / 60 / d.windowDays) * 7;
      const n = d.bookings.length;
      return {
        key: "weekly_load",
        kind: "stat",
        label: "Meeting load",
        value: `${hoursPerWeek.toFixed(1)}h / week`,
        hint: `${n} meeting${n === 1 ? "" : "s"} in the last ${d.windowDays} days`,
      };
    },
  },

  // Share of meetings that start right after another with no breathing room.
  {
    key: "back_to_back_share",
    compute(d: TimeDataset): MetricResult | null {
      if (d.bookings.length < 2) return null;
      const sorted = [...d.bookings].sort((a, b) => a.start.getTime() - b.start.getTime());
      let backToBack = 0;
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const cur = sorted[i];
        if (!prev || !cur) continue;
        const gapMin = (cur.start.getTime() - prev.end.getTime()) / 60_000;
        // A meeting starting within 5 minutes of the previous one ending counts as
        // back-to-back (>= -1 guards against tiny overlaps from rounding).
        if (gapMin >= -1 && gapMin < 5) backToBack++;
      }
      const share = Math.round((backToBack / (sorted.length - 1)) * 100);
      return {
        key: "back_to_back_share",
        kind: "stat",
        label: "Back-to-back",
        value: `${share}%`,
        hint:
          share >= 40
            ? "Little room to breathe - consider default buffers."
            : "A healthy amount of space between meetings.",
      };
    },
  },

  // The longest uninterrupted block of focus time you actually held.
  {
    key: "longest_focus_streak",
    compute(d: TimeDataset): MetricResult | null {
      if (d.focusBlocks.length === 0) return null;
      const sorted = [...d.focusBlocks].sort((a, b) => a.start.getTime() - b.start.getTime());
      let longest = 0;
      let runStart: number | null = null;
      let runEnd = 0;
      for (const block of sorted) {
        const s = block.start.getTime();
        const e = block.end.getTime();
        if (runStart === null) {
          runStart = s;
          runEnd = e;
        } else if (s <= runEnd + 60_000) {
          // Contiguous (touching or overlapping) blocks extend the current streak.
          runEnd = Math.max(runEnd, e);
        } else {
          longest = Math.max(longest, runEnd - runStart);
          runStart = s;
          runEnd = e;
        }
      }
      if (runStart !== null) longest = Math.max(longest, runEnd - runStart);
      const mins = longest / 60_000;
      if (mins < 15) return null;
      return {
        key: "longest_focus_streak",
        kind: "stat",
        label: "Longest focus streak",
        value: fmtDuration(mins),
        hint: `Your biggest uninterrupted block in the last ${d.windowDays} days`,
      };
    },
  },

  // Time with outside guests vs. time with your own team (by email domain).
  {
    key: "external_vs_internal",
    compute(d: TimeDataset): MetricResult | null {
      if (!d.hostDomain) return null;
      let external = 0;
      let internal = 0;
      for (const b of d.bookings) {
        if (b.attendees.length === 0) continue;
        const mins = minutes(b);
        const hasExternal = b.attendees.some((a) => {
          const dom = domainOf(a.email);
          return dom !== null && dom !== d.hostDomain;
        });
        if (hasExternal) external += mins;
        else internal += mins;
      }
      if (external + internal === 0) return null;
      return {
        key: "external_vs_internal",
        kind: "breakdown",
        label: "External vs. internal",
        items: [
          { label: "With outside guests", minutes: external, color: "var(--color-accent)" },
          { label: "With your team", minutes: internal, color: "var(--color-coral)" },
        ],
      };
    },
  },

  // Time in recurring meetings vs. one-off bookings.
  {
    key: "recurring_load",
    compute(d: TimeDataset): MetricResult | null {
      if (d.bookings.length === 0) return null;
      let recurring = 0;
      let oneOff = 0;
      for (const b of d.bookings) {
        if (b.isRecurring) recurring += minutes(b);
        else oneOff += minutes(b);
      }
      if (recurring + oneOff === 0) return null;
      return {
        key: "recurring_load",
        kind: "breakdown",
        label: "Recurring vs. one-off",
        items: [
          { label: "Recurring meetings", minutes: recurring, color: "var(--color-accent)" },
          { label: "One-off meetings", minutes: oneOff, color: "var(--color-mint)" },
        ],
      };
    },
  },

  // Focus time Otter reclaimed for you from cancelled meetings.
  {
    key: "reclaimed_time",
    compute(d: TimeDataset): MetricResult | null {
      const reclaimedMin = sum(d.focusBlocks.filter((b) => b.reclaimed));
      if (reclaimedMin <= 0) return null;
      return {
        key: "reclaimed_time",
        kind: "stat",
        label: "Time reclaimed",
        value: fmtDuration(reclaimedMin),
        hint: `Focus time Otter protected from cancelled meetings in the last ${d.windowDays} days`,
      };
    },
  },
];
