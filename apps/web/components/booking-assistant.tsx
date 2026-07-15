"use client";

import { type Slot, useLocalZone } from "@/components/slot-grid";
import { cn } from "@/lib/cn";
import { Send, Sparkles, X } from "lucide-react";
import { DateTime } from "luxon";
import { useState } from "react";

/**
 * Floating "find me a time" helper on a public booking page. The visitor
 * describes when they're free in plain language; Otter returns matching OPEN
 * slots from the host's real availability. Clicking one selects it in the picker.
 * The host can turn this off (Settings → Preferences); the page then doesn't
 * render it. Guardrailed + rate-limited server-side.
 */
export function BookingAssistant({
  eventTypeId,
  duration,
  onPick,
}: {
  eventTypeId: string;
  /** The visitor's chosen duration (multi-duration event types), so the assistant
   *  offers slots that will actually fit at book time. */
  duration?: number;
  onPick: (slot: Slot) => void;
}) {
  const zone = useLocalZone();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setMessage(null);
    setSlots([]);
    try {
      const res = await fetch("/api/public/booking-assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventTypeId, query: q, tz: zone, durationMinutes: duration }),
      });
      if (!res.ok) {
        setMessage("The assistant isn't available right now - pick a time from the grid.");
        return;
      }
      const d = await res.json();
      setMessage(typeof d.message === "string" ? d.message : null);
      setSlots(Array.isArray(d.slots) ? d.slots : []);
    } catch {
      setMessage("Something went wrong - please pick a time from the grid.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-float)] transition-transform hover:-translate-y-0.5"
      >
        <Sparkles size={16} /> Find me a time
      </button>

      {open ? (
        <div className="fixed right-4 bottom-20 z-40 w-[min(360px,calc(100vw-2rem))] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-float)]">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles size={15} className="text-[var(--color-accent)]" /> Ask Otter
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-md p-1 text-[var(--color-faint)] hover:text-[var(--color-text)]"
            >
              <X size={16} />
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            Tell me when you're free and I'll find open times.
          </p>

          <form onSubmit={ask} className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={300}
              placeholder="e.g. weekday mornings next week"
              className="min-w-0 flex-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <button
              type="submit"
              disabled={busy}
              aria-label="Ask"
              className="flex shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] px-3 text-white disabled:opacity-50"
            >
              <Send size={15} />
            </button>
          </form>

          {busy ? (
            <p className="mt-3 text-sm text-[var(--color-muted)]">Looking…</p>
          ) : message ? (
            <p className="mt-3 text-sm text-[var(--color-text)]">{message}</p>
          ) : null}

          {slots.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {slots.map((s) => (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => {
                    onPick(s);
                    setOpen(false);
                  }}
                  className={cn(
                    "rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-medium",
                    "transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                  )}
                >
                  {DateTime.fromISO(s.start).setZone(zone).toFormat("ccc, LLL d · h:mm a")}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
