"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Calendar, Check, Eye, EyeOff, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ManagedCalendar {
  id: string;
  name: string;
  checkForConflicts: boolean;
  isTargetForBookings: boolean;
  isReadOnly: boolean;
  isHidden: boolean;
}

/** A small pill toggle used for per-calendar controls. */
function Pill({
  active,
  disabled,
  onClick,
  children,
  title,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={
        active
          ? "rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-[11px] text-[var(--color-text)] disabled:opacity-50"
          : "rounded-full border border-[var(--color-border-strong)] px-2.5 py-0.5 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-40"
      }
    >
      {children}
    </button>
  );
}

/**
 * Manage a connection's calendars: rename, include/exclude from availability,
 * pick the booking write target, and hide from the list. Toggles update
 * optimistically (snappy) and reconcile against the server, surfacing a toast
 * and rolling back if the PATCH fails — instead of a full-page refresh per click.
 */
export function CalendarManager({ calendars }: { calendars: ManagedCalendar[] }) {
  const { toast } = useToast();
  const [items, setItems] = useState(calendars);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  async function patch(id: string, body: Partial<ManagedCalendar>, successMsg?: string) {
    const prev = items;
    // Optimistic: apply locally now. Choosing a booking target clears the others
    // (there's a single global target), so mirror that in the UI immediately.
    setItems((cur) =>
      cur.map((c) => {
        if (c.id === id) return { ...c, ...body };
        if (body.isTargetForBookings === true) return { ...c, isTargetForBookings: false };
        return c;
      }),
    );
    setBusyId(id);
    setEditingId(null);
    try {
      const res = await fetch(`/api/calendars/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("patch failed");
      if (successMsg) toast({ title: successMsg, variant: "success" });
    } catch {
      setItems(prev); // roll back
      toast({
        title: "Couldn't update that calendar",
        description: "Please try again.",
        variant: "error",
      });
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-[var(--color-muted)]">Syncing calendars…</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((cal) => (
        <li key={cal.id} className="flex flex-wrap items-center gap-2 text-sm">
          <Calendar size={15} className="shrink-0 text-[var(--color-muted)]" />
          {editingId === cal.id ? (
            <span className="flex items-center gap-1">
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="h-7 w-44 py-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && draftName.trim())
                    patch(cal.id, { name: draftName.trim() }, "Calendar renamed");
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
              <button
                type="button"
                aria-label="Save name"
                disabled={!draftName.trim() || busyId === cal.id}
                onClick={() => patch(cal.id, { name: draftName.trim() }, "Calendar renamed")}
                className="text-[var(--color-success)] hover:opacity-80 disabled:opacity-40"
              >
                <Check size={15} />
              </button>
              <button
                type="button"
                aria-label="Cancel rename"
                onClick={() => setEditingId(null)}
                className="text-[var(--color-faint)] hover:text-[var(--color-text)]"
              >
                <X size={15} />
              </button>
            </span>
          ) : (
            <span className="group inline-flex items-center gap-1">
              <span className={cal.isHidden ? "text-[var(--color-faint)]" : undefined}>
                {cal.name}
              </span>
              <button
                type="button"
                aria-label={`Rename ${cal.name}`}
                onClick={() => {
                  setEditingId(cal.id);
                  setDraftName(cal.name);
                }}
                className="text-[var(--color-faint)] opacity-0 transition-opacity hover:text-[var(--color-text)] group-hover:opacity-100"
              >
                <Pencil size={13} />
              </button>
            </span>
          )}

          {cal.isReadOnly ? (
            <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted)]">
              read-only
            </span>
          ) : null}

          <span className="ml-auto flex items-center gap-1.5">
            <Pill
              active={cal.checkForConflicts}
              disabled={busyId === cal.id}
              onClick={() => patch(cal.id, { checkForConflicts: !cal.checkForConflicts })}
              title="Block availability when this calendar is busy"
            >
              Availability
            </Pill>
            <Pill
              active={cal.isTargetForBookings}
              disabled={busyId === cal.id || cal.isReadOnly}
              onClick={() =>
                !cal.isTargetForBookings && patch(cal.id, { isTargetForBookings: true })
              }
              title={
                cal.isReadOnly
                  ? "Read-only calendars can't receive bookings"
                  : "Write new bookings to this calendar"
              }
            >
              Bookings
            </Pill>
            <button
              type="button"
              aria-label={cal.isHidden ? "Show calendar" : "Hide calendar"}
              title={cal.isHidden ? "Show" : "Hide from lists"}
              disabled={busyId === cal.id}
              onClick={() => patch(cal.id, { isHidden: !cal.isHidden })}
              className="text-[var(--color-faint)] hover:text-[var(--color-text)] disabled:opacity-40"
            >
              {cal.isHidden ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Disconnect an entire calendar account, with a confirm step. */
export function DisconnectButton({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch(`/api/calendars/connection/${connectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("disconnect failed");
      toast({ title: "Calendar disconnected", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't disconnect", description: "Please try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Button variant="danger" size="sm" disabled={busy} onClick={disconnect}>
        {busy ? "Removing…" : "Confirm"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
