# Where your time goes (time-allocation)

An extensible "where your time goes" analytics module. It answers questions the
existing scheduling insights don't - **who** you spend time with, your
**meeting-vs-focus** balance, and **when** in the day meetings land.

## Shape

```
loadDataset(userId, tz, windowDays)   // one pass over bookings + focus blocks
        │
   TimeDataset  ── METRICS[].compute(data) ──▶  MetricResult[]  ──▶ API / UI
```

- `computeTimeAllocation({userId, tz?, windowDays?})` loads the dataset once and
  runs every metric, dropping the ones with no data.
- A `MetricResult` is either a **stat** (one headline number) or a **breakdown**
  (labelled bars). The UI renders both generically, so new metrics need no UI
  work.

## Extending - add an insight

Append a `TimeMetric` to `METRICS` in `metrics.ts`:

```ts
{
  key: "back_to_back_share",
  compute(d) {
    if (d.bookings.length === 0) return null;
    // ...derive from d.bookings / d.focusBlocks...
    return { key: "back_to_back_share", kind: "stat", label: "Back-to-back", value: "38%" };
  },
}
```

It appears on `/api/insights/time` and the "Where your time goes" section
automatically.

## Ideas for future metrics
- `back_to_back_share` - % of meetings with no gap before the next
- `longest_focus_streak` - the biggest uninterrupted block you held
- `external_vs_internal` - time with outside guests vs. teammates (by email domain)
- `recurring_load` - share of time in recurring vs. one-off meetings
- `reclaimed_time` - focus time Otter protected for you

## Notes
- Distinct from `lib/booking/insights.ts` (scheduling counts/funnel). This module
  is specifically about **time allocation**; keep that separation.
- Metrics are pure functions of `TimeDataset` - cheap, testable, no I/O.
