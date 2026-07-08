"use client";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { Check, Clock } from "lucide-react";
import { useState } from "react";

/** One-tap "I'm running late" — notifies the current meeting's attendees. */
export function RunningLateButton({ uid }: { uid: string }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function notify() {
    setBusy(true);
    const res = await fetch(`/api/bookings/${uid}/running-late`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    if (res.ok) {
      setSent(true);
      track("Running Late Notified");
    }
  }

  if (sent) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-success)]">
        <Check size={15} /> Attendees notified
      </span>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={notify} disabled={busy}>
      <Clock size={15} /> {busy ? "Notifying…" : "Running late?"}
    </Button>
  );
}
