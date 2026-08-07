"use client";

import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { CalendarDays } from "lucide-react";
import { DateTime } from "luxon";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { DayPicker, getDefaultClassNames } from "react-day-picker";
import "react-day-picker/style.css";

/**
 * The scheduling control, modelled on Google Calendar's event editor:
 *
 *   [ start date ] [ start time ]  to  [ end time ] [ end date ]
 *
 * Same day by default (you just set the two times), but the end date is there
 * for the occasional multi-day / overnight block. The end-time menu lists times
 * after the start, each with its duration ("1:00 PM (1 hr)").
 *
 * Emits both endpoints as `yyyy-MM-dd'T'HH:mm` strings via `onChange(start, end)`.
 */
const VALUE_FMT = "yyyy-MM-dd'T'HH:mm";

export interface DateTimeRangeFieldProps {
  startValue: string;
  endValue: string;
  onChange: (start: string, end: string) => void;
  /** Earliest selectable day, `yyyy-MM-dd'T'HH:mm`. Optional. */
  min?: string;
  /** Minute granularity of the time menus (default 30). */
  stepMinutes?: number;
  className?: string;
}

function parse(value: string | undefined): DateTime | null {
  if (!value) return null;
  const dt = DateTime.fromFormat(value, VALUE_FMT);
  return dt.isValid ? dt : null;
}

const pad = (n: number) => String(n).padStart(2, "0");
const minutesOf = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const clockOf = (min: number) => `${pad(Math.floor((min % 1440) / 60))}:${pad(min % 60)}`;
const fmt12 = (t: string) => DateTime.fromFormat(t, "HH:mm").toFormat("h:mm a");
const sod = (d: Date) => DateTime.fromJSDate(d).startOf("day");

/** "1 hr", "1.5 hrs", "45 mins", "1 day 2 hrs" - matching Google's end-time hints. */
function durLabel(min: number): string {
  const days = Math.floor(min / 1440);
  const rem = min % 1440;
  const chunks: string[] = [];
  if (days) chunks.push(`${days} day${days > 1 ? "s" : ""}`);
  if (rem) {
    if (rem < 60) chunks.push(`${rem} mins`);
    else {
      const h = rem / 60;
      chunks.push(Number.isInteger(h) ? `${h} hr${h > 1 ? "s" : ""}` : `${h} hrs`);
    }
  }
  return chunks.join(" ");
}

const rdpTheme: CSSProperties = {
  "--rdp-accent-color": "var(--color-accent)",
  "--rdp-accent-background-color": "var(--color-accent-soft)",
  "--rdp-today-color": "var(--color-accent)",
  "--rdp-day-width": "2.15rem",
  "--rdp-day-height": "2.15rem",
  "--rdp-day_button-width": "2.15rem",
  "--rdp-day_button-height": "2.15rem",
  "--rdp-day_button-border-radius": "9999px",
  "--rdp-outside-opacity": "0.4",
  "--rdp-nav_button-width": "2rem",
  "--rdp-nav_button-height": "2rem",
  color: "var(--color-text)",
} as CSSProperties;

/** A compact "Aug 7, 2026" chip that opens a single-day calendar popover. */
function DateChip({
  value,
  onSelect,
  minDay,
  ariaLabel,
}: {
  value: Date;
  onSelect: (d: Date) => void;
  minDay?: Date;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const rdp = getDefaultClassNames();

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <CalendarDays size={15} className="shrink-0 text-[var(--color-accent)]" />
        {DateTime.fromJSDate(value).toFormat("LLL d, yyyy")}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={ariaLabel}
          style={rdpTheme}
          className="absolute z-50 mt-2 rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3 shadow-[0_16px_40px_rgba(15,12,30,0.22)]"
        >
          <DayPicker
            mode="single"
            required
            selected={value}
            onSelect={(d) => {
              if (!d) return;
              onSelect(d);
              setOpen(false);
            }}
            showOutsideDays
            weekStartsOn={1}
            disabled={minDay ? { before: minDay } : undefined}
            classNames={{
              month_caption: "flex items-center justify-center h-8 mb-1",
              caption_label: "text-sm font-semibold text-[var(--color-text)]",
              weekday: "text-[11px] font-medium text-[var(--color-faint)]",
              day: cn(rdp.day, "text-[13px]"),
              selected:
                "[&>button]:!bg-[var(--color-accent)] [&>button]:!text-white [&>button]:!font-semibold [&>button]:!border-0",
              today: "font-semibold text-[var(--color-accent)]",
              outside: "text-[var(--color-faint)]",
              chevron: "fill-[var(--color-muted)]",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DateTimeRangeField({
  startValue,
  endValue,
  onChange,
  min,
  stepMinutes = 30,
  className,
}: DateTimeRangeFieldProps) {
  const startDt = parse(startValue);
  const endDt = parse(endValue);
  const minDt = parse(min);

  const [startDate, setStartDate] = useState<Date>(
    () => (startDt ?? minDt ?? DateTime.now()).startOf("day").toJSDate(),
  );
  const [endDate, setEndDate] = useState<Date>(
    () => (endDt ?? startDt ?? minDt ?? DateTime.now()).startOf("day").toJSDate(),
  );
  const [startTime, setStartTime] = useState(() => startDt?.toFormat("HH:mm") ?? "09:00");
  const [endTime, setEndTime] = useState(() => endDt?.toFormat("HH:mm") ?? "10:00");

  function emitFrom(sd: Date, st: string, ed: Date, et: string) {
    const start = sod(sd).plus({ minutes: minutesOf(st) });
    const end = sod(ed).plus({ minutes: minutesOf(et) });
    onChange(start.toFormat(VALUE_FMT), end.toFormat(VALUE_FMT));
  }

  // Pre-fill a sensible default so a new form isn't empty.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!startValue && !endValue) emitFrom(startDate, startTime, endDate, endTime);
  }, []);

  // Re-sync from external value changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (startDt) {
      setStartDate(startDt.startOf("day").toJSDate());
      setStartTime(startDt.toFormat("HH:mm"));
    }
    if (endDt) {
      setEndDate(endDt.startOf("day").toJSDate());
      setEndTime(endDt.toFormat("HH:mm"));
    }
  }, [startValue, endValue]);

  const startDT = sod(startDate).plus({ minutes: minutesOf(startTime) });
  const endDT = sod(endDate).plus({ minutes: minutesOf(endTime) });
  const sameDay = sod(startDate).hasSame(sod(endDate), "day");

  const timeSlots: string[] = [];
  for (let m = 0; m < 1440; m += stepMinutes) timeSlots.push(clockOf(m));

  // End-time options: after the start on the same day, each with its duration.
  const endOptions = timeSlots
    .filter((t) => !sameDay || minutesOf(t) > minutesOf(startTime))
    .map((t) => {
      const cand = sod(endDate).plus({ minutes: minutesOf(t) });
      const dur = cand.diff(startDT, "minutes").minutes;
      return { value: t, label: dur > 0 ? `${fmt12(t)} (${durLabel(dur)})` : fmt12(t) };
    });

  // Changing the start day shifts the end day by the same amount (keep the span).
  function changeStartDate(d: Date) {
    const deltaDays = Math.round(sod(d).diff(sod(startDate), "days").days);
    const nextEnd = DateTime.fromJSDate(endDate).plus({ days: deltaDays }).toJSDate();
    setStartDate(d);
    setEndDate(nextEnd);
    emitFrom(d, startTime, nextEnd, endTime);
  }

  // Changing the start time keeps the duration (shifts end time / end day).
  function changeStartTime(v: string) {
    const durationMin = Math.max(stepMinutes, endDT.diff(startDT, "minutes").minutes);
    const nextEndDT = sod(startDate).plus({ minutes: minutesOf(v) + durationMin });
    const nextEndDate = nextEndDT.startOf("day").toJSDate();
    const nextEndTime = nextEndDT.toFormat("HH:mm");
    setStartTime(v);
    setEndDate(nextEndDate);
    setEndTime(nextEndTime);
    emitFrom(startDate, v, nextEndDate, nextEndTime);
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <DateChip
        ariaLabel="Start date"
        value={startDate}
        minDay={minDt?.startOf("day").toJSDate()}
        onSelect={changeStartDate}
      />
      <div className="w-[7rem]">
        <Select aria-label="Start time" value={startTime} onChange={(e) => changeStartTime(e.target.value)}>
          {timeSlots.map((t) => (
            <option key={t} value={t}>
              {fmt12(t)}
            </option>
          ))}
        </Select>
      </div>
      <span className="px-0.5 text-sm text-[var(--color-muted)]">to</span>
      <div className="w-[9.5rem]">
        <Select
          aria-label="End time"
          value={endTime}
          onChange={(e) => {
            setEndTime(e.target.value);
            emitFrom(startDate, startTime, endDate, e.target.value);
          }}
        >
          {endOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>
      <DateChip
        ariaLabel="End date"
        value={endDate}
        minDay={startDate}
        onSelect={(d) => {
          setEndDate(d);
          emitFrom(startDate, startTime, d, endTime);
        }}
      />
    </div>
  );
}
