"use client";

import { useToast } from "@/components/ui/toast";
import { useState } from "react";

/**
 * Round-robin weight control for a team member. Higher = booked more often; 0 =
 * paused from the rotation. Saves on change (admins only). Weights flow straight
 * into the weighted round-robin picker.
 */
export function MemberWeight({
  teamId,
  memberId,
  initial,
  editable,
}: {
  teamId: string;
  memberId: string;
  initial: number;
  editable: boolean;
}) {
  const { toast } = useToast();
  const [weight, setWeight] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save(next: number) {
    const clamped = Math.max(0, Math.min(10, next));
    setWeight(clamped);
    setSaving(true);
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priority: clamped }),
    });
    setSaving(false);
    if (!res.ok) {
      setWeight(initial);
      toast({ title: "Couldn't update weight", variant: "error" });
    }
  }

  if (!editable) {
    return (
      <span className="ml-auto text-xs text-[var(--color-faint)]">
        {weight === 0 ? "Paused" : `Weight ${weight}`}
      </span>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-1.5">
      <span className="text-xs text-[var(--color-faint)]">Weight</span>
      <input
        type="number"
        min={0}
        max={10}
        value={weight}
        disabled={saving}
        onChange={(e) => save(Number(e.target.value) || 0)}
        aria-label="Round-robin weight"
        className="h-8 w-14 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 text-sm tabular-nums text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] disabled:opacity-50"
      />
    </div>
  );
}
