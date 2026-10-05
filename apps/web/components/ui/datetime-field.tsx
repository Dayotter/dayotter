"use client";

import { cn } from "@/lib/cn";
import { CalendarDays } from "lucide-react";
import { DateTime } from "luxon";
import type { CSSProperties } from "react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import "react-day-picker/style.css";

/**
 * A date + time picker that replaces the native `<input type="datetime-local">`.
 * Built on react-day-picker (the calendar) + a Calendly-style time column, so it
 * reads and behaves like the pickers people already know. The value contract is
 * identical to the native control - a `yyyy-MM-dd'T'HH:mm` string (empty when
 * unset) - so it drops into every call site unchanged.
 */
const VALUE_FMT = "yyyy-MM-dd'T'HH:mm";

export interface DateTimeFieldProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Earliest selectable instant, same `yyyy-MM-dd'T'HH:mm` format. Optional. */
  min?: string;
  /** Minute granularity of the time list (default 30). */
  stepMinutes?: number;
  placeholder?: string;
  required?: boolean;
  className?: string;
  "aria-label"?: string;
}

function parse(value: string | undefined): DateTime | null {
  if (!value) return null;
  const dt = DateTime.fromFormat(value, VALUE_FMT);
  return dt.isValid ? dt : null;
}

// Theme react-day-picker to our design tokens. Because the tokens flip in dark
// mode, the calendar adapts automatically - no separate dark styles needed.
const rdpTheme: CSSProperties = {
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-accent-soft)",
  "--rdp-today-color": "var(--color-accent)",
  "--rdp-day-width": "2.15rem",
  "--rdp-day-height": "2.15rem",
  "--rdp-day_button-width": "2.15rem",
  "--rdp-day_button-height": "2.15rem",
  "--rdp-day_button-border-radius": "9999px",
  "--rdp-selected-border": "none",
  "--rdp-outside-opacity": "0.4",
  "--rdp-nav_button-width": "2rem",
  "--rdp-nav_button-height": "2rem",
  "--rdp-weekday-opacity": "1",
  color: "var(--color-text)",
} as CSSProperties;

export function DateTimeField({
  id,
  value,
  onChange,
  min,
  stepMinutes = 30,
  placeholder = "Select date & time",
  required,
  className,
  "aria-label": ariaLabel,
}: DateTimeFieldProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  const selected = parse(value);
  const minDt = parse(min);

  // The day the calendar is focused on; a tapped time attaches to it.
  const [draftDay, setDraftDay] = useState<Date>(() =>
    (selected ?? minDt ?? DateTime.now()).startOf("day").toJSDate(),
  );

  // Re-sync from an external value change while closed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional; re-sync keyed on value/open only
  useEffect(() => {
    if (open) return;
    setDraftDay((selected ?? minDt ?? DateTime.now()).startOf("day").toJSDate());
  }, [value, open]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const draft = DateTime.fromJSDate(draftDay);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on draftDay, not the derived `draft`
  const times = useMemo(() => {
    const out: DateTime[] = [];
    let t = draft.startOf("day");
    const end = draft.endOf("day");
    while (t <= end) {
      out.push(t);
      t = t.plus({ minutes: stepMinutes });
    }
    return out;
  }, [draftDay, stepMinutes]);

  // Scroll the chosen time into view when the popover opens (centered); with no
  // choice yet, start the time column at noon instead of midnight - nobody picks
  // a meeting by scanning up from 12 AM, and early hours stay reachable above.
  useEffect(() => {
    if (!open) return;
    const list = timeListRef.current;
    if (!list) return;
    const chosen = list.querySelector<HTMLElement>("[data-selected='true']");
    if (chosen) {
      chosen.scrollIntoView({ block: "center" });
      return;
    }
    const noon = times.find((t) => t.hour >= 12);
    const el = noon ? (list.children[times.indexOf(noon)] as HTMLElement | undefined) : undefined;
    el?.scrollIntoView({ block: "start" });
  }, [open, times]);

  function commitTime(time: DateTime) {
    onChange(draft.set({ hour: time.hour, minute: time.minute }).toFormat(VALUE_FMT));
    setOpen(false);
  }

  const rdp = getDefaultClassNames();
  const label = selected ? selected.toFormat("ccc, LLL d, yyyy · h:mm a") : placeholder;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        id={fieldId}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-left text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          !selected && "text-[var(--color-faint)]",
        )}
      >
        <CalendarDays size={15} className="shrink-0 text-[var(--color-accent)]" />
        <span className="truncate">{label}</span>
      </button>
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={value}
          onChange={() => {}}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
        />
      ) : null}

      {open ? (
        <div
          role="dialog"
          aria-label="Choose date and time"
          style={rdpTheme}
          className="absolute z-50 mt-2 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_16px_40px_rgba(15,12,30,0.22)] sm:w-auto sm:flex-row"
        >
          <DayPicker
            mode="single"
            required
            selected={draftDay}
            onSelect={(d) => d && setDraftDay(d)}
            showOutsideDays
            weekStartsOn={1}
            disabled={minDt ? { before: minDt.startOf("day").toJSDate() } : undefined}
            className="p-3"
            classNames={{
              month_caption: "flex items-center justify-center h-8 mb-1",
              caption_label: "text-sm font-semibold text-[var(--color-text)]",
              weekday: "text-[11px] font-medium text-[var(--color-faint)]",
              day: cn(rdp.day, "text-[13px]"),
              // Solid accent circle for the chosen day (v10's default is a border).
              selected:
                "[&>button]:!bg-[var(--color-accent)] [&>button]:!text-white [&>button]:!font-semibold [&>button]:!border-0",
              today: "font-semibold text-[var(--color-accent)]",
              outside: "text-[var(--color-faint)]",
              chevron: "fill-[var(--color-muted)]",
            }}
          />
          <div className="flex min-h-0 flex-col border-t border-[var(--color-border)] sm:w-[8.5rem] sm:border-l sm:border-t-0">
            <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-muted)]">
              {draft.toFormat("ccc, LLL d")}
            </div>
            <div
              ref={timeListRef}
              className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto p-1.5 sm:flex sm:max-h-[17.5rem] sm:flex-col"
            >
              {times.map((t) => {
                const isSel =
                  !!selected && selected.hasSame(draft, "day") && selected.hasSame(t, "minute");
                const disabled = minDt
                  ? draft.set({ hour: t.hour, minute: t.minute }) < minDt
                  : false;
                return (
                  <button
                    key={t.toFormat("HH:mm")}
                    type="button"
                    disabled={disabled}
                    data-selected={isSel}
                    onClick={() => commitTime(t)}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2 text-center text-sm transition-colors sm:text-left",
                      isSel
                        ? "bg-[var(--color-accent)] font-medium text-[var(--color-accent-fg)]"
                        : "text-[var(--color-text)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)]",
                      disabled &&
                        "cursor-not-allowed opacity-30 hover:bg-transparent hover:text-[var(--color-text)]",
                    )}
                  >
                    {t.toFormat("h:mm a")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
