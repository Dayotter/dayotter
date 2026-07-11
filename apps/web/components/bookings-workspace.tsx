"use client";

import { BookingsCalendar } from "@/components/bookings-calendar";
import { EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { cn } from "@/lib/cn";
import { DateTime } from "luxon";
import { useState } from "react";

export interface HistoryBooking {
  id: string;
  uid: string;
  title: string;
  startsAt: string;
  endsAt: string;
  status: string;
  color: string | null;
  attendees: string[];
}

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  pending: "bg-[var(--color-mint)]/15 text-[var(--color-mint)]",
  cancelled: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  rejected: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  no_show: "bg-[var(--color-amber)]/15 text-[var(--color-amber)]",
  completed: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
};
const STATUS_LABEL: Record<string, string> = { no_show: "no-show" };

type Tab = "calendar" | "history";

/** Bookings surface: a colour-coded calendar (month/week/agenda) plus a full
 *  history list (including past + cancelled). */
export function BookingsWorkspace({ tz, history }: { tz: string; history: HistoryBooking[] }) {
  const [tab, setTab] = useState<Tab>("calendar");

  return (
    <>
      <div className="mb-5 flex rounded-md border border-[var(--color-border-strong)] p-0.5 w-fit">
        {(["calendar", "history"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-sm px-4 py-1.5 text-sm capitalize transition-colors",
              tab === t
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "calendar" ? (
        <BookingsCalendar tz={tz} />
      ) : history.length === 0 ? (
        <EmptyState
          title="No bookings yet"
          description="Calm waters for now — when someone books one of your booking types, it surfaces here."
        />
      ) : (
        <div className="space-y-2">
          {history.map((b) => (
            <HistoryRow key={b.id} b={b} tz={tz} />
          ))}
        </div>
      )}
    </>
  );
}

function HistoryRow({ b, tz }: { b: HistoryBooking; tz: string }) {
  const [status, setStatus] = useState(b.status);
  const isPast = new Date(b.endsAt).getTime() < Date.now();
  // Past meetings auto-complete, so the no-show toggle covers confirmed/completed/no_show.
  const canMark =
    isPast && (status === "confirmed" || status === "completed" || status === "no_show");

  async function toggleNoShow() {
    const noShow = status !== "no_show";
    // Optimistic: undo on a past meeting returns to `completed`.
    setStatus(noShow ? "no_show" : "completed");
    const res = await fetch(`/api/bookings/${b.uid}/no-show`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ noShow }),
    });
    if (!res.ok) setStatus(b.status);
  }

  return (
    <Card className="flex items-center gap-4 px-4 py-3">
      <span
        aria-hidden
        className="h-9 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: eventColorVar(b.color) }}
      />
      <div className="w-28 shrink-0 text-sm">
        <p className="font-medium">{DateTime.fromISO(b.startsAt).setZone(tz).toFormat("LLL d")}</p>
        <p className="text-xs text-[var(--color-muted)]">
          {DateTime.fromISO(b.startsAt).setZone(tz).toFormat("h:mm a")}
        </p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{b.title}</p>
        <p className="truncate text-xs text-[var(--color-muted)]">
          {b.attendees.join(", ") || "No attendees"}
        </p>
      </div>
      {canMark ? (
        <button
          type="button"
          onClick={toggleNoShow}
          className="shrink-0 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
        >
          {status === "no_show" ? "Undo" : "No-show"}
        </button>
      ) : null}
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
          STATUS_STYLES[status] ?? "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
        )}
      >
        {STATUS_LABEL[status] ?? status}
      </span>
    </Card>
  );
}
