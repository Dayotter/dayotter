"use client";

import { BookingsCalendar } from "@/components/bookings-calendar";
import { EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { eventColorVar } from "@/lib/booking/event-type-input";
import { cn } from "@/lib/cn";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
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

// History status filters. Each maps one or more raw booking statuses to a
// friendly label; a filter only shows when the history actually contains it.
const FILTERS: { key: string; label: string; match: (status: string) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "confirmed", label: "Confirmed", match: (s) => s === "confirmed" },
  { key: "completed", label: "Completed", match: (s) => s === "completed" },
  { key: "cancelled", label: "Cancelled", match: (s) => s === "cancelled" || s === "rejected" },
  { key: "no_show", label: "No-show", match: (s) => s === "no_show" },
  { key: "pending", label: "Pending", match: (s) => s === "pending" },
];

/** Bookings surface: a colour-coded calendar (month/week/agenda) plus a full
 *  history list (including past + cancelled). */
export function BookingsWorkspace({ tz, history }: { tz: string; history: HistoryBooking[] }) {
  // Default to History so the server-loaded rows render immediately; the
  // calendar fetches its own range only when that tab is opened.
  const [tab, setTab] = useState<Tab>("history");
  const [statusFilter, setStatusFilter] = useState("all");

  // Only surface filters that match at least one booking (besides "All"), and
  // only bother showing the row when there's more than one status to filter by.
  const availableFilters = FILTERS.filter(
    (f) => f.key === "all" || history.some((b) => f.match(b.status)),
  );
  const showFilters = availableFilters.length > 2;
  const active = FILTERS.find((f) => f.key === statusFilter) ?? FILTERS[0]!;
  const shownHistory = history.filter((b) => active.match(b.status));

  return (
    <>
      <div className="mb-5 flex rounded-md border border-[var(--color-border-strong)] p-0.5 w-fit">
        {(["history", "calendar"] as Tab[]).map((t) => (
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
          description="Calm waters for now - when someone books one of your booking types, it surfaces here."
        />
      ) : (
        <>
          {showFilters ? (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {availableFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStatusFilter(f.key)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    statusFilter === f.key
                      ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : null}
          {shownHistory.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--color-muted)]">
              No {active.label.toLowerCase()} bookings.
            </p>
          ) : (
            <div className="space-y-2">
              {shownHistory.map((b) => (
                <HistoryRow key={b.id} b={b} tz={tz} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function HistoryRow({ b, tz }: { b: HistoryBooking; tz: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(b.status);
  const open = () => router.push(`/booking/${b.uid}`);
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
    <Card
      interactive
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className="flex cursor-pointer items-center gap-4 px-4 py-3"
    >
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
          onClick={(e) => {
            e.stopPropagation();
            toggleNoShow();
          }}
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
