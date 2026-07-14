import { DateTime } from "luxon";
import type { MetricResult, TimeDataset, TimeMetric } from "./types";

const minutes = (b: { start: Date; end: Date }) => (b.end.getTime() - b.start.getTime()) / 60_000;
const sum = (arr: { start: Date; end: Date }[]) => arr.reduce((s, b) => s + minutes(b), 0);

/**
 * The "where your time goes" metrics. Each reads the shared dataset and returns
 * one card, or null when there isn't enough to say. To add an insight, append a
 * TimeMetric here — the API and UI pick it up automatically.
 */
export const METRICS: TimeMetric[] = [
  // Meeting time vs. focus time held — the core balance.
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
      return {
        key: "weekly_load",
        kind: "stat",
        label: "Meeting load",
        value: `${hoursPerWeek.toFixed(1)}h / week`,
        hint: `${d.bookings.length} meetings in the last ${d.windowDays} days`,
      };
    },
  },
];
