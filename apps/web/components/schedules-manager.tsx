"use client";

import { AvailabilityEditor } from "@/components/availability-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

interface ScheduleSummary {
  id: string;
  name: string;
  isDefault: boolean;
  ruleCount: number;
}

interface Range {
  start: string;
  end: string;
}
interface Override {
  date: string;
  start: string | null;
  end: string | null;
}
interface ScheduleDetail {
  timezone: string;
  days: Range[][];
  overrides: Override[];
}

export function SchedulesManager({
  initialSchedules,
  initialSelected,
  initialDetail,
}: {
  initialSchedules: ScheduleSummary[];
  initialSelected: string;
  initialDetail: ScheduleDetail;
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selectedId, setSelectedId] = useState(initialSelected);
  const [detail, setDetail] = useState<ScheduleDetail | null>(initialDetail);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const selected = schedules.find((s) => s.id === selectedId);

  async function loadDetail(id: string) {
    setLoading(true);
    setDetail(null);
    const res = await fetch(`/api/schedules/${id}`);
    setLoading(false);
    if (res.ok) {
      const d = await res.json();
      setDetail({ timezone: d.timezone, days: d.days, overrides: d.overrides });
    }
  }

  function select(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    loadDetail(id);
  }

  async function refreshList() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules((await res.json()).schedules);
  }

  async function createSchedule() {
    const name = window.prompt("Name this schedule (e.g. Consulting hours)")?.trim();
    if (!name) return;
    setBusy(true);
    const res = await fetch("/api/schedules", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    if (res.ok) {
      const { id } = await res.json();
      await refreshList();
      setSelectedId(id);
      await loadDetail(id);
    }
  }

  async function rename(id: string, current: string) {
    const name = window.prompt("Rename schedule", current)?.trim();
    if (!name || name === current) return;
    setBusy(true);
    await fetch(`/api/schedules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setBusy(false);
    await refreshList();
  }

  async function makeDefault(id: string) {
    setBusy(true);
    await fetch(`/api/schedules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setBusy(false);
    await refreshList();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? Event types using it will fall back to your default.`))
      return;
    setBusy(true);
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Could not delete." }));
      window.alert(error ?? "Could not delete.");
      return;
    }
    await refreshList();
    if (id === selectedId) {
      const fallback = schedules.find((s) => s.isDefault) ?? schedules.find((s) => s.id !== id);
      if (fallback) select(fallback.id);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <aside className="space-y-2">
        <ul className="space-y-1">
          {schedules.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => select(s.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  s.id === selectedId
                    ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                {s.isDefault ? (
                  <span
                    title="Default schedule"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)]"
                  >
                    <Star size={11} fill="currentColor" /> Default
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={createSchedule}
          disabled={busy}
        >
          <Plus size={14} /> New schedule
        </Button>
      </aside>

      <div>
        {selected ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-lg font-semibold">{selected.name}</h2>
            <Button variant="ghost" size="sm" onClick={() => rename(selected.id, selected.name)}>
              Rename
            </Button>
            {!selected.isDefault ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => makeDefault(selected.id)}>
                  <Star size={14} /> Make default
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[var(--color-danger)]"
                  onClick={() => remove(selected.id, selected.name)}
                >
                  <Trash2 size={14} /> Delete
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {loading || !detail ? (
          <div className="flex items-center gap-2 py-16 text-sm text-[var(--color-muted)]">
            <Loader2 size={15} className="animate-spin" /> Loading…
          </div>
        ) : (
          <AvailabilityEditor key={selectedId} scheduleId={selectedId} initial={detail} />
        )}
      </div>
    </div>
  );
}
