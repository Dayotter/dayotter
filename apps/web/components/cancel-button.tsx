"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ uid, isRecurring = false }: { uid: string; isRecurring?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [wholeSeries, setWholeSeries] = useState(false);

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: reason.trim() || undefined,
        scope: isRecurring && wholeSeries ? "series" : "one",
      }),
    });
    if (!res.ok) {
      setLoading(false);
      setError("Could not cancel - it may already be cancelled.");
      return;
    }
    router.push(`/booking/${uid}`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="cancel-reason" className="mb-1.5 block text-sm font-medium">
          Reason <span className="font-normal text-[var(--color-faint)]">(optional)</span>
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder="Add a note - it's included in the cancellation email everyone gets."
          className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        />
      </div>
      {isRecurring ? (
        <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
          <input
            type="checkbox"
            checked={wholeSeries}
            onChange={(e) => setWholeSeries(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border-strong)] text-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
          Cancel this and all later occurrences
        </label>
      ) : null}
      <Button variant="danger" className="w-full" onClick={cancel} disabled={loading}>
        {loading
          ? "Cancelling…"
          : isRecurring && wholeSeries
            ? "Yes, cancel the whole series"
            : "Yes, cancel this booking"}
      </Button>
      <FormError>{error}</FormError>
    </div>
  );
}
