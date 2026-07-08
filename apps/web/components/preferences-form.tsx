"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "system" | "light" | "dark";

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

export function PreferencesForm({
  initial,
}: {
  initial: {
    timeFormat: "12h" | "24h";
    weekStartsOn: number;
    theme: Theme;
    defaultReminderOffsets: number[];
  };
}) {
  const [timeFormat, setTimeFormat] = useState(initial.timeFormat);
  const [weekStartsOn, setWeekStartsOn] = useState(initial.weekStartsOn);
  const [theme, setTheme] = useState<Theme>(initial.theme);
  const [reminders, setReminders] = useState<number[]>(initial.defaultReminderOffsets);
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
      body: JSON.stringify({ timeFormat, weekStartsOn, theme, defaultReminderOffsets: reminders }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    setSaved(true);
  }

  return (
    <Card className="max-w-xl">
      <CardBody className="p-6">
        <form onSubmit={onSubmit} className="space-y-5">
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
