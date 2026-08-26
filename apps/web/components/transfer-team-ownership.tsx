"use client";

import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Crown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Hand the team over to another member. Owner-only. The current owner becomes an
 * admin afterwards, which is what lets them then leave the team (the owner can't
 * leave directly). Confirm-first, since ownership is a one-way handover.
 */
export function TransferTeamOwnership({
  teamId,
  memberId,
  name,
}: {
  teamId: string;
  memberId: string;
  name: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function transfer() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "owner" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast({
        title: "Couldn't transfer ownership",
        description: typeof data.error === "string" ? data.error : undefined,
        variant: "error",
      });
      return;
    }
    setOpen(false);
    toast({ title: `${name} is now the team owner`, variant: "success" });
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <span className="inline-flex items-center gap-1">
          <Crown size={13} /> Make owner
        </span>
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={transfer}
        title={`Make ${name} the team owner?`}
        description="You'll become an admin, and can then leave the team if you need to. This can't be undone by you - only the new owner can transfer it back."
        confirmLabel="Transfer ownership"
        loading={busy}
      />
    </>
  );
}
