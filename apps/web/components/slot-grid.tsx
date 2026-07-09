"use client";

import { cn } from "@/lib/cn";
import { Layers } from "lucide-react";
import { Sparkles } from "lucide-react";
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
  duration,
}: {
  eventTypeId: string;
  onSelect: (slot: Slot) => void;
  /** Chosen duration for multi-duration event types (refetches when it changes). */
  duration?: number;
}) {
  const zone = useLocalZone();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [recommended, setRecommended] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  // SavvyCal-style overlay: the booker's own busy intervals (from a pasted ICS
  // feed), used to grey out slots that clash with their calendar.
  const [overlayShown, setOverlayShown] = useState(false);
  const [overlayUrl, setOverlayUrl] = useState("");
  const [overlayState, setOverlayState] = useState<"idle" | "loading" | "on" | "error">("idle");
  const [overlayError, setOverlayError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ s: number; e: number }[]>([]);

  useEffect(() => {
    setLoading(true);
    const from = new Date().toISOString();
    const to = new Date(Date.now() + 14 * 86_400_000).toISOString();
    const durationParam = duration ? `&duration=${duration}` : "";
    let active = true;
    fetch(`/api/availability/${eventTypeId}?from=${from}&to=${to}${durationParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setSlots(data.slots ?? []);
        setRecommended(data.recommended ?? []);
      })
      .catch(() => {
        if (!active) return;
        setSlots([]);
        setRecommended([]);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [eventTypeId, duration]);

  async function applyOverlay() {
    if (!overlayUrl.trim()) return;
    setOverlayState("loading");
    setOverlayError(null);
    try {
      const res = await fetch("/api/overlay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          icsUrl: overlayUrl.trim(),
          from: new Date().toISOString(),
          to: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setOverlayState("error");
        setOverlayError(
          typeof data.error === "string" ? data.error : "Couldn't read that calendar.",
        );
        return;
      }
      setBusy(
        (data.busy as { start: string; end: string }[]).map((b) => ({
          s: new Date(b.start).getTime(),
          e: new Date(b.end).getTime(),
        })),
      );
      setOverlayState("on");
    } catch {
      setOverlayState("error");
      setOverlayError("Couldn't read that calendar.");
    }
  }

  function clearOverlay() {
    setBusy([]);
    setOverlayState("idle");
    setOverlayError(null);
  }

  /** True if the booker's calendar has a commitment overlapping this slot. */
  function hasConflict(slot: Slot): boolean {
    if (busy.length === 0) return false;
    const s = new Date(slot.start).getTime();
    const e = new Date(slot.end).getTime();
    return busy.some((b) => s < b.e && e > b.s);
  }

  const recommendedSet = useMemo(() => new Set(recommended), [recommended]);
  // Resolve recommended ISO starts back to slot objects, in chronological order.
  const recommendedSlots = useMemo(
    () =>
      recommended.map((iso) => slots.find((s) => s.start === iso)).filter((s): s is Slot => !!s),
    [recommended, slots],
  );

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
      {recommendedSlots.length > 0 ? (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] p-3">
          <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)]">
            <Sparkles size={13} /> Recommended times
          </p>
          <div className="flex flex-wrap gap-2">
            {recommendedSlots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => onSelect(s)}
                className="rounded-md border border-[var(--color-accent)]/40 bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/10"
              >
                {DateTime.fromISO(s.start).setZone(zone).toFormat("ccc, LLL d · h:mm a")}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-faint)]">Times shown in {zone}</p>
        {!overlayShown ? (
          <button
            type="button"
            onClick={() => setOverlayShown(true)}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            <Layers size={12} /> Overlay my calendar
          </button>
        ) : null}
      </div>

      {overlayShown ? (
        <div className="mb-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <p className="mb-2 text-xs text-[var(--color-muted)]">
            Paste your calendar's secret iCal (ICS) address to grey out times you're already busy.
            It's read once and never stored.
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={overlayUrl}
              onChange={(e) => setOverlayUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              className="min-w-0 flex-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <button
              type="button"
              onClick={applyOverlay}
              disabled={overlayState === "loading" || !overlayUrl.trim()}
              className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-medium text-[var(--color-accent-fg)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50"
            >
              {overlayState === "loading" ? "Reading…" : "Overlay"}
            </button>
            {overlayState === "on" ? (
              <button
                type="button"
                onClick={clearOverlay}
                className="rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:bg-[var(--color-surface)]"
              >
                Clear
              </button>
            ) : null}
          </div>
          {overlayError ? (
            <p className="mt-2 text-xs text-[var(--color-danger)]">{overlayError}</p>
          ) : null}
          {overlayState === "on" ? (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              Overlaid {busy.length} commitment{busy.length === 1 ? "" : "s"} — greyed times clash
              with your calendar.
            </p>
          ) : null}
        </div>
      ) : null}

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
          {daySlots.map((s) => {
            const isRecommended = recommendedSet.has(s.start);
            const conflict = hasConflict(s);
            return (
              <button
                key={s.start}
                type="button"
                onClick={() => onSelect(s)}
                title={conflict ? "You have something on your calendar then" : undefined}
                className={cn(
                  "inline-flex items-center justify-center gap-1 rounded-md border py-2 text-sm transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                  conflict
                    ? "border-[var(--color-border)] text-[var(--color-faint)] line-through decoration-[var(--color-faint)]"
                    : isRecommended
                      ? "border-[var(--color-accent)]/50 text-[var(--color-accent)]"
                      : "border-[var(--color-border-strong)]",
                )}
              >
                {isRecommended && !conflict ? <Sparkles size={11} /> : null}
                {DateTime.fromISO(s.start).setZone(zone).toFormat("h:mm a")}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
