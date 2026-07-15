"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Detects the browser's timezone once on load and, if the account is still on
 * the unconfigured UTC default, saves it. The server only accepts the change
 * when the stored zone is UTC/unset, so a deliberately-chosen zone is never
 * clobbered. Refreshes so server components (dashboard, suggestions, insights)
 * immediately render in the right zone. Renders nothing.
 */
export function TimezoneSync() {
  const router = useRouter();
  useEffect(() => {
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return;
    }
    if (!tz || tz === "UTC") return;

    // Only POST once per detected zone - the server short-circuits an already-set
    // zone anyway, so hitting it on every page load is wasted. Re-syncs if the
    // browser's zone later changes (e.g. the user travels).
    const KEY = "dayotter:tzsynced";
    try {
      if (localStorage.getItem(KEY) === tz) return;
    } catch {
      /* storage blocked (private mode) - fall through and just POST. */
    }

    fetch("/api/me/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    })
      .then((r) => r.json())
      .then((d) => {
        try {
          localStorage.setItem(KEY, tz);
        } catch {
          /* ignore */
        }
        if (d?.updated) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  return null;
}
