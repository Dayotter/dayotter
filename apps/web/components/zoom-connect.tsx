"use client";

import { buttonVariants } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useEffect, useState } from "react";

interface ZoomState {
  connected: boolean;
  account: string | null;
}

/** Connect / disconnect Zoom in the same style as calendar providers. */
export function ZoomConnect() {
  const [state, setState] = useState<ZoomState | null>(null);

  useEffect(() => {
    fetch("/api/integrations/zoom")
      .then((r) => r.json())
      .then((d) => setState({ connected: Boolean(d.connected), account: d.account ?? null }))
      .catch(() => setState({ connected: false, account: null }));
  }, []);

  async function disconnect() {
    setState({ connected: false, account: null });
    await fetch("/api/integrations/zoom", { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-3">
      <span className="flex items-center gap-3 text-sm">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-sm text-white"
          style={{ background: "#2D8CFF" }}
        >
          <Video size={16} />
        </span>
        <span>
          Zoom
          {state?.connected && state.account ? (
            <span className="block text-xs text-[var(--color-muted)]">{state.account}</span>
          ) : (
            <span className="block text-xs text-[var(--color-faint)]">
              Auto-create a meeting for each Zoom booking
            </span>
          )}
        </span>
      </span>
      {state?.connected ? (
        <button
          type="button"
          onClick={disconnect}
          className="text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)]"
        >
          Disconnect
        </button>
      ) : (
        <a
          href="/api/integrations/zoom/connect"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Connect
        </a>
      )}
    </div>
  );
}
