"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ uid }: { uid: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() || undefined }),
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
      <Button variant="danger" className="w-full" onClick={cancel} disabled={loading}>
        {loading ? "Cancelling…" : "Yes, cancel this booking"}
      </Button>
      <FormError>{error}</FormError>
    </div>
  );
}
