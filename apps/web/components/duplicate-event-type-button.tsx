"use client";

import { track } from "@/lib/analytics";
import { Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Duplicate an event type, then jump straight to editing the copy. */
export function DuplicateEventTypeButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function duplicate() {
    setBusy(true);
    setFailed(false);
    const res = await fetch(`/api/event-types/${id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.id) {
      setBusy(false);
      setFailed(true);
      setTimeout(() => setFailed(false), 3000);
      return;
    }
    track("Event Type Duplicated");
    router.push(`/event-types/${data.id}/edit`);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={duplicate}
      disabled={busy}
      title={failed ? "Something went wrong - try again" : undefined}
      className={`inline-flex items-center gap-1 text-sm disabled:opacity-60 ${
        failed
          ? "text-[var(--color-danger)]"
          : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <Copy size={13} /> {failed ? "Couldn't duplicate" : busy ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
