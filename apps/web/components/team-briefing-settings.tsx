"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Team daily-digest settings (owner/admin only). Toggle the shared briefing, pick
 * the hour, and choose who receives it. Saves via PATCH /api/teams/[id]/briefing.
 */
export function TeamBriefingSettings({
  teamId,
  initial,
}: {
  teamId: string;
  initial: { enabled: boolean; hour: number; recipients: "admins" | "all" };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initial.enabled);
  const [hour, setHour] = useState(initial.hour);
  const [recipients, setRecipients] = useState<"admins" | "all">(initial.recipients);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/briefing`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled, hour, recipients }),
      });
      if (!res.ok) throw new Error("save failed");
      toast({ title: "Team briefing saved", variant: "success" });
      setDirty(false);
      router.refresh();
    } catch {
      toast({ title: "Couldn't save", description: "Please try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            setDirty(true);
          }}
          className="mt-0.5 accent-[var(--color-accent)]"
        />
        <span>
          Send a daily team briefing
          <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
            Each morning, a shared digest of the team's day - total meetings, load per member, and
            focus time held - over email and notification channels.
          </span>
        </span>
      </label>

      {enabled ? (
        <div className="space-y-3 pl-6">
          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Send at
            <select
              value={hour}
              onChange={(e) => {
                setHour(Number(e.target.value));
                setDirty(true);
              }}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
              aria-label="Team briefing hour"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h === 0 ? "12 AM" : h < 12 ? `${h} AM` : h === 12 ? "12 PM" : `${h - 12} PM`}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--color-faint)]">team lead's local time</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
            Send to
            <select
              value={recipients}
              onChange={(e) => {
                setRecipients(e.target.value as "admins" | "all");
                setDirty(true);
              }}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm"
              aria-label="Team briefing recipients"
            >
              <option value="admins">Owners &amp; admins</option>
              <option value="all">All members</option>
            </select>
          </label>
        </div>
      ) : null}

      {dirty ? (
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      ) : null}
    </div>
  );
}
