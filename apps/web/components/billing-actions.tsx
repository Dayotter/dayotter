"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

/** Upgrade / manage buttons that redirect to Stripe Checkout or the portal. */
export function BillingActions({ plan }: { plan: "free" | "pro" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong");
        setBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach billing. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {plan === "pro" ? (
        <Button variant="secondary" onClick={() => go("/api/billing/portal")} disabled={busy}>
          {busy ? "Opening…" : "Manage billing"}
        </Button>
      ) : (
        <Button onClick={() => go("/api/billing/checkout")} disabled={busy}>
          {busy ? "Starting…" : "Upgrade to Pro"}
        </Button>
      )}
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
