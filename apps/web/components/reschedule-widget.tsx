"use client";
import { FormError } from "@/components/ui/form";

import { type Slot, SlotGrid, useLocalZone } from "@/components/slot-grid";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RescheduleWidget({ uid, eventTypeId }: { uid: string; eventTypeId: string }) {
  const router = useRouter();
  const zone = useLocalZone();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: selected.start, reason: reason.trim() || undefined }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitting(false);
      setError(typeof data.error === "string" ? data.error : "Could not reschedule");
      return;
    }
    router.push(`/booking/${uid}`);
    router.refresh();
  }

  if (!selected) return <SlotGrid eventTypeId={eventTypeId} onSelect={setSelected} />;

  return (
    <div>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={15} /> Pick another time
      </button>
      <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
        Move to{" "}
        <span className="font-medium">
          {DateTime.fromISO(selected.start).setZone(zone).toFormat("cccc, LLLL d 'at' h:mm a")}
        </span>
        <span className="text-[var(--color-muted)]"> · {zone}</span>
      </div>
      <div className="mb-4">
        <label htmlFor="reschedule-reason" className="mb-1.5 block text-sm font-medium">
          Reason <span className="font-normal text-[var(--color-faint)]">(optional)</span>
        </label>
        <textarea
          id="reschedule-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Add a note - it's included in the reschedule email everyone gets."
          className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        />
      </div>
      <FormError>{error}</FormError>
      <Button className="w-full" onClick={confirm} disabled={submitting}>
        {submitting ? "Rescheduling…" : "Confirm new time"}
      </Button>
    </div>
  );
}
