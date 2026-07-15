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
    fetch("/api/me/timezone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.updated) router.refresh();
      })
      .catch(() => {});
  }, [router]);

  return null;
}
