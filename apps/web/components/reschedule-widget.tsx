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

  async function confirm() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: selected.start }),
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
      <FormError>{error}</FormError>
      <Button className="w-full" onClick={confirm} disabled={submitting}>
        {submitting ? "Rescheduling…" : "Confirm new time"}
      </Button>
    </div>
  );
}
