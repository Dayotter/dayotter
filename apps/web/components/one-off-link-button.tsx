"use client";

import { track } from "@/lib/analytics";
import { Check, LinkIcon } from "lucide-react";
import { useState } from "react";

/** Generate a single-use booking link and copy it to the clipboard. */
export function OneOffLinkButton({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "copied" | "error">("idle");

  async function create() {
    setState("busy");
    const res = await fetch(`/api/event-types/${id}/links`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setState("error");
      setTimeout(() => setState("idle"), 3000);
      return;
    }
    const full = `${window.location.origin}${data.url}`;
    try {
      await navigator.clipboard.writeText(full);
    } catch {
      window.prompt("Copy your single-use link:", full);
    }
    track("One-off Link Created");
    setState("copied");
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <button
      type="button"
      onClick={create}
      disabled={state === "busy"}
      className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] disabled:opacity-60"
    >
      {state === "copied" ? (
        <>
          <Check size={13} className="text-[var(--color-success)]" /> Link copied
        </>
      ) : state === "error" ? (
        <span className="inline-flex items-center gap-1 text-[var(--color-danger)]">
          <LinkIcon size={13} /> Couldn't create
        </span>
      ) : (
        <>
          <LinkIcon size={13} /> {state === "busy" ? "Creating…" : "One-off link"}
        </>
      )}
    </button>
  );
}
