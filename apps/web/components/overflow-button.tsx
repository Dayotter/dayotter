"use client";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Check, Clock } from "lucide-react";
import { useState } from "react";

/**
 * Overflow nudge (#6): the current meeting is running long - one tap tells the
 * *next* meeting's attendees the host may join a few minutes late.
 */
export function OverflowButton({ uid }: { uid: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function notify() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/notify-next`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      track("Overflow Notified");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(typeof data.error === "string" ? data.error : "Couldn't notify your next meeting");
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-success)]">
        <Check size={15} /> Next meeting notified
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={notify} disabled={busy}>
        <Clock size={15} /> {busy ? "Notifying…" : "Running late for your next?"}
      </Button>
      {error ? <span className="text-xs text-[var(--color-danger)]">{error}</span> : null}
    </div>
  );
}
