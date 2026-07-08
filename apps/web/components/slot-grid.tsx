"use client";

import { cn } from "@/lib/cn";
import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";

export interface Slot {
  start: string;
  end: string;
}

/** The visitor's local IANA timezone. */
export function useLocalZone() {
  return useMemo(() => DateTime.local().zoneName, []);
}

/**
 * Shared availability picker: fetches slots for an event type and renders the
 * day selector + time grid. Calls `onSelect` with the chosen slot. Used by both
 * the booking flow and the reschedule flow so they look identical.
 */
export function SlotGrid({
  eventTypeId,
  onSelect,
}: {
  eventTypeId: string;
  onSelect: (slot: Slot) => void;
}) {
  const zone = useLocalZone();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
    fetch(`/api/availability/${eventTypeId}?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [eventTypeId]);

  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = DateTime.fromISO(s.start).setZone(zone).toISODate()!;
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return map;
  }, [slots, zone]);

  const days = useMemo(() => [...byDay.keys()].sort(), [byDay]);
  const currentDay = activeDay ?? days[0] ?? null;
  const daySlots = currentDay ? (byDay.get(currentDay) ?? []) : [];

  if (loading) return <p className="text-sm text-[var(--color-muted)]">Loading availability…</p>;
  if (days.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">No times available in the next two weeks.</p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-xs text-[var(--color-faint)]">Times shown in {zone}</p>
      <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:gap-6">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:max-h-80 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto sm:pb-0 sm:pr-1">
          {days.map((d) => {
            const dt = DateTime.fromISO(d);
            const isActive = d === currentDay;
            return (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDay(d)}
                className={cn(
                  "flex shrink-0 items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors sm:shrink",
                  isActive
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
                )}
              >
                <span className="whitespace-nowrap">{dt.toFormat("ccc, LLL d")}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {(byDay.get(d) ?? []).length}
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {daySlots.map((s) => (
            <button
              key={s.start}
              type="button"
              onClick={() => onSelect(s)}
              className="rounded-md border border-[var(--color-border-strong)] py-2 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
            >
              {DateTime.fromISO(s.start).setZone(zone).toFormat("h:mm a")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
