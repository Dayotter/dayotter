"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Disconnect a connected CRM (Salesforce / HubSpot), with a confirm step. */
export function CrmDisconnectButton({ provider }: { provider: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/crm/${provider}`, { method: "DELETE" });
      if (!res.ok) throw new Error("disconnect failed");
      toast({ title: "CRM disconnected", variant: "success" });
      router.refresh();
    } catch {
      toast({ title: "Couldn't disconnect", description: "Please try again.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        Disconnect
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Button variant="danger" size="sm" disabled={busy} onClick={disconnect}>
        {busy ? "Removing…" : "Confirm"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}
