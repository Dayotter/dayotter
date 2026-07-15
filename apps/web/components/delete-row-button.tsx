"use client";

import { ConfirmDialog } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Small trash button + confirm dialog that DELETEs `endpoint` and refreshes.
 *  Rendered as a sibling of the row's Link (never nested inside an anchor). */
export function DeleteRowButton({ endpoint, label }: { endpoint: string; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function del() {
    setBusy(true);
    const res = await fetch(endpoint, { method: "DELETE" });
    setBusy(false);
    setOpen(false);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${label}`}
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-md p-2 text-[var(--color-faint)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
      >
        <Trash2 size={16} />
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={del}
        title={`Delete ${label}?`}
        description="This can't be undone."
        confirmLabel="Delete"
        danger
        loading={busy}
      />
    </>
  );
}
