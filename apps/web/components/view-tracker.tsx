"use client";

import { useEffect } from "react";

const VISITOR_KEY = "dayotter_visitor_id";

/** Stable per-browser visitor id (for unique-visitor counts; no PII). */
function visitorId(): string | undefined {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

/**
 * Fires a one-shot funnel beacon when a public booking page mounts. Renders
 * nothing. Failures are swallowed — analytics must never break booking.
 */
export function ViewTracker({ eventTypeId }: { eventTypeId: string }) {
  useEffect(() => {
    const payload = JSON.stringify({ eventTypeId, visitorId: visitorId() });
    try {
      // Prefer sendBeacon so it survives navigation to the booking form.
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track/view", new Blob([payload], { type: "application/json" }));
        return;
      }
    } catch {
      // fall through to fetch
    }
    fetch("/api/track/view", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  }, [eventTypeId]);

  return null;
}
