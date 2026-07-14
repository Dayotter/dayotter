"use client";

import { track } from "@/lib/analytics";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

/**
 * Copies an absolute booking link to the clipboard. Accepts a path (e.g.
 * "/handle/slug") and resolves it against the current origin at click time so
 * it works across dev/prod without threading the base URL through the server.
 */
export function CopyLinkButton({
  path,
  label = "Copy link",
  className,
}: {
  path: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}${path}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard blocked (e.g. insecure context) - fall back to a prompt.
      window.prompt("Copy this link", url);
      return;
    }
    track("Booking Link Copied", { path });
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ??
        "inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      }
      aria-label={label}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Copied" : label}
    </button>
  );
}
