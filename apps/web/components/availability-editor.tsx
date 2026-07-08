"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Check, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

interface Range {
  start: string; // "HH:MM"
  end: string;
}

// Display Monday-first; values map to dayOfWeek 0=Sun..6=Sat.
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

function timezoneList(current: string): string[] {
  try {
    const all = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (all?.length) return all;
  } catch {
    /* older runtime */
  }
  return [current, "UTC"];
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors",
        on
          ? "bg-[var(--color-accent)]"
          : "border border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

const timeInputClass =
  "rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

export function AvailabilityEditor({
  initial,
}: {
  initial: { timezone: string; days: Range[][] };
}) {
  const [timezone, setTimezone] = useState(initial.timezone);
  const [days, setDays] = useState<Range[][]>(initial.days);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const zones = useMemo(() => timezoneList(initial.timezone), [initial.timezone]);

  function update(dow: number, next: Range[]) {
    setDays((prev) => prev.map((r, i) => (i === dow ? next : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timezone,
        days: days.map((ranges, dayOfWeek) => ({ dayOfWeek, ranges })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save. Check your times and try again.");
      return;
    }
    setSaved(true);
  }

  return (
    <div>
      <div className="mb-6 max-w-sm">
        <label className="mb-1.5 block text-sm font-medium">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSaved(false);
          }}
          className="h-10 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {DAY_ORDER.map((dow) => {
          const ranges = days[dow] ?? [];
          const on = ranges.length > 0;
          return (
            <div key={dow} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start">
              <div className="flex w-40 shrink-0 items-center gap-3">
                <Toggle
                  on={on}
                  onClick={() => update(dow, on ? [] : [{ start: "09:00", end: "17:00" }])}
                />
                <span className={cn("text-sm font-medium", !on && "text-[var(--color-muted)]")}>
                  {DAY_LABELS[dow]}
                </span>
              </div>

              <div className="flex-1">
                {!on ? (
                  <span className="text-sm text-[var(--color-faint)]">Unavailable</span>
                ) : (
                  <div className="space-y-2">
                    {ranges.map((r, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          type="time"
                          step={900}
                          value={r.start}
                          onChange={(e) =>
                            update(
                              dow,
                              ranges.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                            )
                          }
                          className={timeInputClass}
                        />
                        <span className="text-[var(--color-muted)]">–</span>
                        <input
                          type="time"
                          step={900}
                          value={r.end}
                          onChange={(e) =>
                            update(
                              dow,
                              ranges.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                            )
                          }
                          className={timeInputClass}
                        />
                        <button
                          type="button"
                          aria-label="Remove"
                          onClick={() =>
                            update(
                              dow,
                              ranges.filter((_, j) => j !== i),
                            )
                          }
                          className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => update(dow, [...ranges, { start: "09:00", end: "17:00" }])}
                      className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
                    >
                      <Plus size={14} /> Add time
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-success)]">
            <Check size={15} /> Saved
          </span>
        ) : null}
        <FormError>{error}</FormError>
      </div>
    </div>
  );
}
