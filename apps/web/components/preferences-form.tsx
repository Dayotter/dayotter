"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { type Locale, SUPPORTED_LOCALES } from "@/lib/i18n";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

/** Native-language labels for the language picker. Booking + Otter chrome are
 *  translated; the rest of the dashboard is English for now (see #81). */
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

/** Same mechanism as ThemeToggle so both controls stay in sync. */
function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("theme", theme);
}

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

const REMINDER_OPTIONS = [
  { value: 10_080, label: "1 week" },
  { value: 1_440, label: "1 day" },
  { value: 120, label: "2 hours" },
  { value: 60, label: "1 hour" },
  { value: 30, label: "30 min" },
  { value: 10, label: "10 min" },
];

const WEEK_DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 6, label: "Saturday" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const minutesToHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const hhmmToMinutes = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function PreferencesForm({
  initial,
}: {
  initial: {
    timeFormat: "12h" | "24h";
    weekStartsOn: number;
    theme: Theme;
    locale: Locale;
    defaultReminderOffsets: number[];
    adaptiveAvailability?: boolean;
    maxMeetingsPerDay?: number;
    travelBufferMinutes?: number;
    reclaimCancelledTime?: boolean;
    overflowNotifyEnabled?: boolean;
    briefingEnabled?: boolean;
    briefingHour?: number;
    scribeEnabled?: boolean;
    lunchEnabled?: boolean;
    lunchStartMinute?: number;
    lunchEndMinute?: number;
    bookingPageAssistant?: boolean;
  };
}) {
  const [timeFormat, setTimeFormat] = useState(initial.timeFormat);
  const [weekStartsOn, setWeekStartsOn] = useState(initial.weekStartsOn);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [locale, setLocale] = useState<Locale>(initial.locale);
  const [reminders, setReminders] = useState<number[]>(initial.defaultReminderOffsets);
  const [adaptive, setAdaptive] = useState(initial.adaptiveAvailability ?? false);
  const [maxPerDay, setMaxPerDay] = useState(initial.maxMeetingsPerDay ?? 5);
  const [travelBuffer, setTravelBuffer] = useState(initial.travelBufferMinutes ?? 0);
  const [reclaim, setReclaim] = useState(initial.reclaimCancelledTime ?? false);
  const [overflowNotify, setOverflowNotify] = useState(initial.overflowNotifyEnabled ?? false);
  const [briefingOn, setBriefingOn] = useState(initial.briefingEnabled ?? false);
  const [briefingHour, setBriefingHour] = useState(initial.briefingHour ?? 8);
  const [scribeOn, setScribeOn] = useState(initial.scribeEnabled ?? false);
  const [lunchOn, setLunchOn] = useState(initial.lunchEnabled ?? false);
  const [lunchStart, setLunchStart] = useState(initial.lunchStartMinute ?? 720);
  const [lunchEnd, setLunchEnd] = useState(initial.lunchEndMinute ?? 780);
  const [bookingAssistant, setBookingAssistant] = useState(initial.bookingPageAssistant ?? true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed the theme control from the live client setting (localStorage) so it
  // never disagrees with the toggle in the nav.
  useEffect(() => {
    const live = localStorage.getItem("theme") as Theme | null;
    if (live) setTheme(live);
  }, []);

  function selectTheme(next: Theme) {
    setTheme(next);
    setSaved(false);
    applyTheme(next);
  }

  function toggleReminder(value: number) {
    setSaved(false);
    setReminders((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        timeFormat,
        weekStartsOn,
        theme,
        locale,
        defaultReminderOffsets: reminders,
        adaptiveAvailability: adaptive,
        maxMeetingsPerDay: maxPerDay,
        travelBufferMinutes: travelBuffer,
        reclaimCancelledTime: reclaim,
        overflowNotifyEnabled: overflowNotify,
        briefingEnabled: briefingOn,
        briefingHour,
        scribeEnabled: scribeOn,
        lunchEnabled: lunchOn,
        lunchStartMinute: lunchStart,
        lunchEndMinute: lunchEnd,
        bookingPageAssistant: bookingAssistant,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    setSaved(true);
    // The app shell resolves the language on the server, so a change only takes
    // effect on reload - refresh once so the new locale applies immediately.
    if (locale !== initial.locale) window.location.reload();
  }

  return (
    <Card className="max-w-2xl">
      <CardBody className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
            Display
          </p>
          <div>
            <Label>Theme</Label>
            <div className="flex gap-2">
              {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectTheme(value)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md border py-2 text-sm transition-colors",
                    theme === value
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                      : "border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="pref-time">Time format</Label>
              <Select
                id="pref-time"
                value={timeFormat}
                onChange={(e) => {
                  setTimeFormat(e.target.value as "12h" | "24h");
                  setSaved(false);
                }}
              >
                <option value="12h">12-hour (1:30 PM)</option>
                <option value="24h">24-hour (13:30)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="pref-week">Week starts on</Label>
              <Select
                id="pref-week"
                value={weekStartsOn}
                onChange={(e) => {
                  setWeekStartsOn(Number(e.target.value));
                  setSaved(false);
                }}
              >
                {WEEK_DAYS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="pref-language">Language</Label>
            <Select
              id="pref-language"
              value={locale}
              onChange={(e) => {
                setLocale(e.target.value as Locale);
                setSaved(false);
              }}
            >
              {SUPPORTED_LOCALES.map((l) => (
                <option key={l} value={l}>
                  {LOCALE_LABELS[l]}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Your booking page and the Otter assistant use this language. The rest of the dashboard
              is English for now.
            </p>
          </div>

          <p className="border-t border-[var(--color-border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
            Reminders
          </p>
          <div>
            <Label>Default reminders</Label>
            <p className="mb-2 -mt-1 text-xs text-[var(--color-faint)]">
              When to remind you and your attendees before a meeting.
            </p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_OPTIONS.map((o) => {
                const on = reminders.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggleReminder(o.value)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-text)]"
                        : "border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
                    )}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="border-t border-[var(--color-border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
            Time protection
          </p>
          <div className="pt-1">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={adaptive}
                onChange={(e) => {
                  setAdaptive(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Focus protection (adaptive availability)
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  On heavy days, stop offering slots once you hit your meeting cap - and
                  hard-decline any booking that would push a day over it - so a full day doesn't get
                  fuller and your focus time is protected.
                </span>
              </span>
            </label>
            {adaptive ? (
              <div className="mt-3 flex items-center gap-2">
                <Label htmlFor="max-per-day">Max meetings/day</Label>
                <Input
                  id="max-per-day"
                  type="number"
                  min={1}
                  max={20}
                  value={maxPerDay}
                  onChange={(e) => {
                    setMaxPerDay(Number(e.target.value) || 1);
                    setSaved(false);
                  }}
                  className="w-20"
                />
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={bookingAssistant}
                onChange={(e) => {
                  setBookingAssistant(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Booking-page AI helper
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Show visitors a floating "find me a time" assistant on your public booking page -
                  it suggests open slots from natural language. Turn off to hide it.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <Label htmlFor="travel-buffer">Travel time for in-person meetings</Label>
            <p className="mb-2 -mt-1 text-xs text-[var(--color-faint)]">
              Reserve this much travel time before and after every in-person booking, so you're
              never offered back-to-back slots with no room to get there. 0 = off.
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="travel-buffer"
                type="number"
                min={0}
                max={240}
                step={5}
                value={travelBuffer}
                onChange={(e) => {
                  setTravelBuffer(Math.max(0, Number(e.target.value) || 0));
                  setSaved(false);
                }}
                className="w-24"
              />
              <span className="text-sm text-[var(--color-muted)]">minutes each way</span>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={reclaim}
                onChange={(e) => {
                  setReclaim(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Reclaim cancelled time as focus
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  When an upcoming meeting is cancelled, hold onto that time as a focus block
                  instead of re-opening it for booking. You can always remove the block.
                </span>
              </span>
            </label>
          </div>

          <p className="border-t border-[var(--color-border)] pt-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
            Otter &amp; notifications
          </p>
          <div className="pt-1">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={overflowNotify}
                onChange={(e) => {
                  setOverflowNotify(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Auto-notify my next meeting if I'm running behind
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  When a meeting is booked back-to-back, we'll email the next meeting's guests a
                  quick "running a few minutes behind" heads-up at the first meeting's end - so
                  nobody's left waiting. Like a great EA would.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={briefingOn}
                onChange={(e) => {
                  setBriefingOn(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Send me a daily morning briefing
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Each morning, Otter sends a calm summary of your day - today's meetings and the
                  focus time you've held - over email and your notification channels.
                </span>
              </span>
            </label>
            {briefingOn ? (
              <label className="mt-3 flex items-center gap-2 pl-6 text-sm text-[var(--color-muted)]">
                Send at
                <select
                  value={briefingHour}
                  onChange={(e) => {
                    setBriefingHour(Number(e.target.value));
                    setSaved(false);
                  }}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
                  aria-label="Briefing hour"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-[var(--color-faint)]">your local time</span>
              </label>
            ) : null}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={scribeOn}
                onChange={(e) => {
                  setScribeOn(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Send me a recap after each meeting
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Just after a meeting ends, Otter emails you a recap with one-tap next steps - book
                  a follow-up, send notes to attendees, or review the meeting.
                </span>
              </span>
            </label>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={lunchOn}
                onChange={(e) => {
                  setLunchOn(e.target.checked);
                  setSaved(false);
                }}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Lunch break
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Block this window every day so no one can book over your lunch (in your schedule's
                  timezone).
                </span>
              </span>
            </label>
            {lunchOn ? (
              <div className="mt-3 flex items-center gap-2">
                <Input
                  aria-label="Lunch start"
                  type="time"
                  value={minutesToHHMM(lunchStart)}
                  onChange={(e) => {
                    setLunchStart(hhmmToMinutes(e.target.value));
                    setSaved(false);
                  }}
                  className="w-32"
                />
                <span className="text-sm text-[var(--color-muted)]">to</span>
                <Input
                  aria-label="Lunch end"
                  type="time"
                  value={minutesToHHMM(lunchEnd)}
                  onChange={(e) => {
                    setLunchEnd(hhmmToMinutes(e.target.value));
                    setSaved(false);
                  }}
                  className="w-32"
                />
              </div>
            ) : null}
            {lunchOn && lunchEnd <= lunchStart ? (
              <p className="mt-2 text-xs text-[var(--color-danger)]">
                Lunch end must be after the start.
              </p>
            ) : null}
          </div>

          <FormError>{error}</FormError>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
                <Check size={15} /> Saved
              </span>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
