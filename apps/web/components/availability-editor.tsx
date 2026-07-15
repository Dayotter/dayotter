"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { Check, Copy, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Range {
  start: string; // "HH:MM"
  end: string;
}

interface Override {
  date: string; // "YYYY-MM-DD"
  start: string | null; // null = unavailable all day
  end: string | null;
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
        // Border in BOTH states + inline-flex/items-center so the knob stays
        // vertically centred and the track never shifts size when toggled.
        "inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border px-0.5 transition-colors",
        on
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]"
          : "border-[var(--color-border-strong)] bg-[var(--color-surface-2)]",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
          on ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );
}

const timeInputClass =
  "rounded-sm border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-1.5 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

export function AvailabilityEditor({
  initial,
  scheduleId,
}: {
  initial: { timezone: string; days: Range[][]; overrides?: Override[] };
  /** When set, save to this named schedule; otherwise the legacy default endpoint. */
  scheduleId?: string;
}) {
  const [timezone, setTimezone] = useState(initial.timezone);
  const [days, setDays] = useState<Range[][]>(initial.days);
  const [overrides, setOverrides] = useState<Override[]>(initial.overrides ?? []);
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hours use an explicit Save (unlike the instant schedule actions), so guard
  // against navigating away with unsaved edits. Derive "dirty" by comparing the
  // current state to what was loaded - no need to flag every handler.
  const dirty = useMemo(
    () =>
      JSON.stringify({ timezone, days, overrides }) !==
      JSON.stringify({
        timezone: initial.timezone,
        days: initial.days,
        overrides: initial.overrides ?? [],
      }),
    [timezone, days, overrides, initial],
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function addOverride() {
    if (!newDate || overrides.some((o) => o.date === newDate)) return;
    setOverrides((prev) =>
      [...prev, { date: newDate, start: null, end: null }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    );
    setNewDate("");
    setSaved(false);
  }
  function patchOverride(date: string, patch: Partial<Override>) {
    setOverrides((prev) => prev.map((o) => (o.date === date ? { ...o, ...patch } : o)));
    setSaved(false);
  }
  function removeOverride(date: string) {
    setOverrides((prev) => prev.filter((o) => o.date !== date));
    setSaved(false);
  }

  const zones = useMemo(() => timezoneList(initial.timezone), [initial.timezone]);

  function update(dow: number, next: Range[]) {
    setDays((prev) => prev.map((r, i) => (i === dow ? next : r)));
    setSaved(false);
  }

  /** One-tap presets - the common cases, so nobody sets seven days by hand. */
  function applyPreset(preset: "weekdays" | "everyday" | "clear") {
    const nineToFive: Range[] = [{ start: "09:00", end: "17:00" }];
    setDays((prev) =>
      prev.map((_, dow) => {
        if (preset === "clear") return [];
        if (preset === "everyday") return nineToFive.map((r) => ({ ...r }));
        return dow >= 1 && dow <= 5 ? nineToFive.map((r) => ({ ...r })) : []; // weekdays = Mon–Fri
      }),
    );
    setSaved(false);
  }

  /** Copy one day's hours onto every day - the other "I do the same thing daily" shortcut. */
  function copyToAll(dow: number) {
    setDays((prev) => {
      const src = prev[dow] ?? [];
      return prev.map(() => src.map((r) => ({ ...r })));
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(scheduleId ? `/api/schedules/${scheduleId}` : "/api/schedule", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timezone,
        days: days.map((ranges, dayOfWeek) => ({ dayOfWeek, ranges })),
        overrides,
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
    <div className="max-w-2xl">
      <div className="mb-6 max-w-sm">
        <label htmlFor="timezone" className="mb-1.5 block text-sm font-medium">
          Timezone
        </label>
        <Select
          id="timezone"
          value={timezone}
          onChange={(e) => {
            setTimezone(e.target.value);
            setSaved(false);
          }}
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h3 className="text-sm font-semibold">Weekly hours</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
            Quick set
          </span>
          {(
            [
              { key: "weekdays", label: "Weekdays 9–5" },
              { key: "everyday", label: "Every day 9–5" },
              { key: "clear", label: "Clear all" },
            ] as const
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className="rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-xs font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-3 text-sm text-[var(--color-muted)]">
        The hours you're open for bookings each week. Toggle a day off to block it entirely.
      </p>

      <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {DAY_ORDER.map((dow) => {
          const ranges = days[dow] ?? [];
          const on = ranges.length > 0;
          return (
            <div
              key={dow}
              className={cn(
                "flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center",
                on ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-2)]/40",
              )}
            >
              <div className="flex w-36 shrink-0 items-center gap-3 sm:self-start sm:pt-1.5">
                <Toggle
                  on={on}
                  onClick={() => update(dow, on ? [] : [{ start: "09:00", end: "17:00" }])}
                />
                <span className={cn("text-sm font-medium", !on && "text-[var(--color-muted)]")}>
                  {DAY_LABELS[dow]}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                {!on ? (
                  <span className="text-sm text-[var(--color-faint)] sm:leading-8">
                    Unavailable
                  </span>
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
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <button
                        type="button"
                        onClick={() => update(dow, [...ranges, { start: "09:00", end: "17:00" }])}
                        className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline"
                      >
                        <Plus size={14} /> Add time
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToAll(dow)}
                        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                      >
                        <Copy size={13} /> Copy to all days
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-semibold">Date overrides</h3>
        <p className="mt-0.5 mb-3 text-sm text-[var(--color-muted)]">
          Block out holidays or set different hours for specific dates.
        </p>

        {overrides.length > 0 ? (
          <div className="mb-3 divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
            {overrides.map((o) => {
              const unavailable = o.start === null;
              return (
                <div
                  key={o.date}
                  className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center"
                >
                  <span className="w-32 shrink-0 text-sm font-medium">{o.date}</span>
                  <div className="flex flex-1 items-center gap-3">
                    <Toggle
                      on={!unavailable}
                      onClick={() =>
                        patchOverride(
                          o.date,
                          unavailable
                            ? { start: "09:00", end: "17:00" }
                            : { start: null, end: null },
                        )
                      }
                    />
                    {unavailable ? (
                      <span className="text-sm text-[var(--color-faint)]">Unavailable</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          step={900}
                          value={o.start ?? "09:00"}
                          onChange={(e) => patchOverride(o.date, { start: e.target.value })}
                          className={timeInputClass}
                        />
                        <span className="text-[var(--color-muted)]">–</span>
                        <input
                          type="time"
                          step={900}
                          value={o.end ?? "17:00"}
                          onChange={(e) => patchOverride(o.date, { end: e.target.value })}
                          className={timeInputClass}
                        />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove override"
                    onClick={() => removeOverride(o.date)}
                    className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className={timeInputClass}
          />
          <button
            type="button"
            onClick={addOverride}
            disabled={!newDate}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:underline disabled:opacity-50"
          >
            <Plus size={14} /> Add override
          </button>
        </div>
      </div>

      {/* Sticky action bar - Save stays reachable no matter how far you scroll
          through the hours + overrides, instead of stranding at the bottom. */}
      <div className="sticky bottom-4 z-10 mt-8 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 shadow-[var(--shadow-card)] backdrop-blur">
        <Button onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : "Save availability"}
        </Button>
        {dirty ? (
          <span className="text-sm text-[var(--color-amber)]">Unsaved changes</span>
        ) : saved ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-success)]">
            <Check size={15} /> Saved
          </span>
        ) : (
          <span className="text-sm text-[var(--color-muted)]">All changes saved</span>
        )}
        <FormError>{error}</FormError>
      </div>
    </div>
  );
}
