"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface ImportResult {
  account: string;
  eventTypesImported: number;
  eventTypesSkipped: number;
  schedulesImported: number;
  rulesImported: number;
  warnings: string[];
}

export function CalendlyImport() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/import/calendly", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Import failed. Please try again.");
        return;
      }
      setResult(data as ImportResult);
      setToken("");
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
            <p className="font-medium">Imported from {result.account}.</p>
            <p className="mt-0.5 text-[var(--color-text)]">
              {result.eventTypesImported} event type{result.eventTypesImported === 1 ? "" : "s"}
              {result.schedulesImported > 0
                ? ` and ${result.schedulesImported} availability schedule${result.schedulesImported === 1 ? "" : "s"}`
                : ""}
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
        <div className="flex gap-2">
          <Link
            href="/event-types"
            className="text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            Review imported event types →
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={() => setResult(null)}>
          Import again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="calendly-token">Calendly access token</Label>
        <Input
          id="calendly-token"
          type="password"
          autoComplete="off"
          placeholder="eyJraWQiOi…"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="mt-1.5 font-mono"
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Create a Personal Access Token in{" "}
          <a
            href="https://calendly.com/integrations/api_webhooks"
            target="_blank"
            rel="noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            Calendly → Integrations → API &amp; webhooks
          </a>
          . It's used once for this import and never stored.
        </p>
      </div>
      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-[var(--color-danger)]">
          <AlertTriangle size={14} /> {error}
        </p>
      ) : null}
      <Button onClick={run} disabled={busy || token.trim().length < 10} className="gap-1.5">
        {busy ? <Loader2 size={15} className="animate-spin" /> : null}
        {busy ? "Importing…" : "Import from Calendly"}
      </Button>
    </div>
  );
}
