"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CancelButton({ uid }: { uid: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/bookings/${uid}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      setLoading(false);
      setError("Could not cancel — it may already be cancelled.");
      return;
    }
    router.push(`/booking/${uid}`);
    router.refresh();
  }

  return (
    <div>
      <Button variant="danger" className="w-full" onClick={cancel} disabled={loading}>
        {loading ? "Cancelling…" : "Yes, cancel this booking"}
      </Button>
      <FormError>{error}</FormError>
    </div>
  );
}
