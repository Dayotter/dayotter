"use client";

import { Star, X } from "lucide-react";
import { useEffect, useState } from "react";

const KEY = "dayotter_star_nudge_dismissed";
const REPO = "https://github.com/Dayotter/dayotter";

/**
 * A small, one-time ask to star the repo on GitHub. Stars are the number both
 * developers and automated evaluators weight most for an open-source project, and
 * ours has lagged the signups. Dismissible and remembered per browser, so it never
 * nags. Renders nothing until we've checked localStorage (avoids a flash).
 */
export function StarNudge() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) !== "1") setShow(true);
    } catch {
      // Private mode / storage blocked: just don't show it.
    }
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
  }

  if (!show) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)]/50 px-4 py-3">
      <Star size={18} className="shrink-0 text-[var(--color-amber)]" />
      <p className="flex-1 text-sm text-[var(--color-muted)]">
        Enjoying DayOtter? A GitHub star genuinely helps others find it, and it's free.
      </p>
      <a
        href={REPO}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        <Star size={14} /> Star on GitHub
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-[var(--color-faint)] hover:text-[var(--color-text)]"
      >
        <X size={16} />
      </button>
    </div>
  );
}
