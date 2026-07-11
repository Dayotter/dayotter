"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CalendarOff, Clock, Trash2 } from "lucide-react";
import { DateTime } from "luxon";
import { useState } from "react";

interface Rule {
  id: string;
  kind: string; // 'holiday' | 'no_meeting'
  label: string | null;
  theDate: string | null;
  dayOfWeek: number | null;
  startMinute: number | null;
  endMinute: number | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function describe(r: Rule): string {
  if (r.kind === "holiday") {
    const d = r.theDate ? DateTime.fromISO(r.theDate).toFormat("cccc, LLL d, yyyy") : "a day";
    return `Holiday · ${d}`;
  }
  const when = r.dayOfWeek == null ? "Every day" : `${DAYS[r.dayOfWeek]}s`;
  const win =
    r.startMinute != null && r.endMinute != null
      ? `${toHHMM(r.startMinute)}–${toHHMM(r.endMinute)}`
      : "";
  return `No meetings · ${when} ${win}`.trim();
}

/**
 * Manage a team's scheduling rules (company holidays + meeting-free windows).
 * Members see them; admins can add/remove. Rules block bookings for every member.
 */
export function TeamRules({
  teamId,
  canManage,
  initial,
}: {
  teamId: string;
  canManage: boolean;
  initial: Rule[];
}) {
  const [rules, setRules] = useState<Rule[]>(initial);
  const [kind, setKind] = useState<"holiday" | "no_meeting">("holiday");
  const [label, setLabel] = useState("");
  const [theDate, setTheDate] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string>(""); // "" = every day
  const [start, setStart] = useState("13:00");
  const [end, setEnd] = useState("17:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const bodyPayload =
      kind === "holiday"
        ? { kind, label: label || undefined, theDate }
        : {
            kind,
            label: label || undefined,
            dayOfWeek: dayOfWeek === "" ? null : Number(dayOfWeek),
            startMinute: toMin(start),
            endMinute: toMin(end),
          };
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/rules`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(bodyPayload),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't add that rule");
      return;
    }
    setRules((prev) => [...prev, data.rule as Rule]);
    setLabel("");
    setTheDate("");
  }

  async function remove(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/teams/${teamId}/rules/${id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      {rules.length > 0 ? (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-4 py-2.5"
            >
              {r.kind === "holiday" ? (
                <CalendarOff size={16} className="text-[var(--color-accent)]" />
              ) : (
                <Clock size={16} className="text-[var(--color-accent)]" />
              )}
              <div className="min-w-0 flex-1">
                {r.label ? <p className="truncate text-sm font-medium">{r.label}</p> : null}
                <p className="text-xs text-[var(--color-muted)]">{describe(r)}</p>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label="Remove rule"
                  className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--color-muted)]">
          No rules yet. Add company holidays or meeting-free windows below.
        </p>
      )}

      {canManage ? (
        <form onSubmit={add} className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <div>
              <Label htmlFor="tr-kind">Rule</Label>
              <Select
                id="tr-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as "holiday" | "no_meeting")}
              >
                <option value="holiday">Company holiday</option>
                <option value="no_meeting">Meeting-free window</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="tr-label">Label (optional)</Label>
              <Input
                id="tr-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={kind === "holiday" ? "Christmas Day" : "Focus Fridays"}
              />
            </div>
          </div>

          {kind === "holiday" ? (
            <div className="max-w-xs">
              <Label htmlFor="tr-date">Date</Label>
              <Input
                id="tr-date"
                type="date"
                value={theDate}
                onChange={(e) => setTheDate(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label htmlFor="tr-dow">Day</Label>
                <Select
                  id="tr-dow"
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(e.target.value)}
                >
                  <option value="">Every day</option>
                  {DAYS.map((d, i) => (
                    <option key={d} value={i}>
                      {d}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="tr-start">From</Label>
                <Input
                  id="tr-start"
                  type="time"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="w-32"
                />
              </div>
              <div>
                <Label htmlFor="tr-end">To</Label>
                <Input
                  id="tr-end"
                  type="time"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          )}

          <FormError>{error}</FormError>
          <Button type="submit" size="sm" disabled={busy || (kind === "holiday" && !theDate)}>
            {busy ? "Adding…" : "Add rule"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
