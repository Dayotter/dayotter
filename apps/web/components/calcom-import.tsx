"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImportResult {
  eventTypesImported: number;
  eventTypesSkipped: number;
  warnings: string[];
}

/**
 * Import event types from Cal.com (cloud or self-hosted) via a v1 API key.
 * Turns the "Cal.com went closed-source" migration into a one-paste move.
 */
export function CalcomImport() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/import/calcom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim(),
          baseUrl: baseUrl.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import failed. Please try again.");
        return;
      }
      setResult(data as ImportResult);
      setApiKey("");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-md border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 px-4 py-3 text-sm text-[var(--color-success)]">
          <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Imported from Cal.com.</p>
            <p className="mt-0.5 text-[var(--color-text)]">
              {result.eventTypesImported} event type{result.eventTypesImported === 1 ? "" : "s"}
              {result.eventTypesSkipped > 0 ? ` · ${result.eventTypesSkipped} skipped` : ""}.
            </p>
          </div>
        </div>
        {result.warnings.length > 0 ? (
          <ul className="space-y-1.5 text-xs text-[var(--color-muted)]">
            {result.warnings.map((w) => (
              <li key={w} className="flex items-start gap-1.5">
                <AlertTriangle size={13} className="mt-0.5 shrink-0 text-[var(--color-amber)]" />
                {w}
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href="/event-types"
          className="text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          Review imported event types →
        </Link>
        <div>
          <Button variant="outline" size="sm" onClick={() => setResult(null)}>
            Import again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="calcom-key">Cal.com API key</Label>
        <Input
          id="calcom-key"
          type="password"
          autoComplete="off"
          placeholder="cal_live_…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="mt-1.5 font-mono"
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Create one in Cal.com → Settings → Developer → API keys. Used once for this import and
          never stored.
        </p>
      </div>
      <div>
        <Label htmlFor="calcom-base">Self-hosted API base (optional)</Label>
        <Input
          id="calcom-base"
          placeholder="https://cal.your-company.com/api/v1"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="mt-1.5 font-mono"
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Leave blank for Cal.com cloud. Must be a public HTTPS URL.
        </p>
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-[var(--color-danger)]">
          <AlertTriangle size={14} /> {error}
        </p>
      ) : null}
      <Button onClick={run} disabled={busy || apiKey.trim().length < 6} className="gap-1.5">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        {busy ? "Importing…" : "Import from Cal.com"}
      </Button>
    </div>
  );
}
