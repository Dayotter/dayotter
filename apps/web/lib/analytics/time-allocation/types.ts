/** The shared, pre-loaded dataset every metric computes from (one DB read). */
export interface TimeDataset {
  tz: string;
  /** Half-window in days: the view spans `windowDays` back and `windowDays` ahead. */
  windowDays: number;
  /** Total days the window covers (`windowDays * 2`), used to normalise rates. */
  spanDays: number;
  /** The host's own email domain (e.g. "acme.com"), for external/internal splits.
   * Null when the host has no email or a non-standard address. */
  hostDomain: string | null;
  bookings: {
    start: Date;
    end: Date;
    attendees: { name: string | null; email: string }[];
    typeTitle: string;
    color: string | null;
    /** Part of a recurring series (vs a one-off booking). */
    isRecurring: boolean;
  }[];
  /** Focus / deep-work blocks the user held in the window. */
  focusBlocks: {
    start: Date;
    end: Date;
    /** True when this block is time reclaimed from a cancelled meeting. */
    reclaimed: boolean;
  }[];
}

/** A single headline number, e.g. "Meeting load - 12h / week". */
export interface StatResult {
  key: string;
  kind: "stat";
  label: string;
  value: string;
  /** Optional supporting line. */
  hint?: string;
}

/** A labelled breakdown rendered as proportional bars, e.g. who you meet. */
export interface BreakdownResult {
  key: string;
  kind: "breakdown";
  label: string;
  items: { label: string; minutes: number; color?: string | null }[];
}

export type MetricResult = StatResult | BreakdownResult;

/**
 * A pluggable "where your time goes" metric. This is the extension point: add a
 * TimeMetric to METRICS (metrics.ts) and it appears on the dashboard/insights
 * surface automatically. Return `null` when there isn't enough data.
 */
export interface TimeMetric {
  key: string;
  compute(data: TimeDataset): MetricResult | null;
}
