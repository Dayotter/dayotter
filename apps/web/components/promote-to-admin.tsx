"use client";

import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Promote a member to admin. Owner-only. Admins can create and edit team event
 * types, manage members, and toggle bookable eligibility.
 */
export function PromoteToAdmin({
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

  async function promote() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast({
        title: "Couldn't promote member",
        description: typeof data.error === "string" ? data.error : undefined,
        variant: "error",
      });
      return;
    }
    setOpen(false);
    toast({ title: `${name} is now a team admin`, variant: "success" });
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
          <Shield size={13} /> Make admin
        </span>
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={promote}
        title={`Make ${name} a team admin?`}
        description="Admins can create and edit team event types, manage members, and toggle booking eligibility."
        confirmLabel="Promote to admin"
        loading={busy}
      />
    </>
  );
}
