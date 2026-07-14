"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { track } from "@/lib/analytics";
import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

type Suggestion =
  | {
      id: string;
      type: "focus";
      title: string;
      detail: string;
      startISO: string;
      durationMinutes: number;
    }
  | { id: string; type: "enable_overflow"; title: string; detail: string }
  | { id: string; type: "enable_briefing"; title: string; detail: string };

const DISMISS_KEY = "otter:dismissed";
const CONFIRM_LABEL: Record<Suggestion["type"], string> = {
  focus: "Protect",
  enable_overflow: "Turn on",
  enable_briefing: "Enable",
};

function loadDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/**
 * Proactive Otter - the assistant surfacing a couple of high-value things to do
 * right now (protect open focus time, turn on running-late alerts, start a
 * morning briefing), each confirm-first. Renders nothing when there's nothing
 * worth nudging. Dismissed suggestions are remembered locally so it stays calm.
 */
export function ProactiveOtter() {
  const [items, setItems] = useState<Suggestion[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/otter/suggestions")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        const dismissed = loadDismissed();
        setItems(((d.suggestions ?? []) as Suggestion[]).filter((s) => !dismissed.has(s.id)));
      })
      .catch(() => active && setItems([]));
    return () => {
      active = false;
    };
  }, []);

  function remove(id: string) {
    setItems((prev) => (prev ?? []).filter((s) => s.id !== id));
  }

  function dismiss(id: string) {
    try {
      const next = loadDismissed();
      next.add(id);
      localStorage.setItem(DISMISS_KEY, JSON.stringify([...next]));
    } catch {
      // best-effort - still hide it this session
    }
    track("Otter Suggestion Dismissed");
    remove(id);
  }

  async function confirm(s: Suggestion) {
    setBusy(s.id);
    setError(null);
    const payload =
      s.type === "focus"
        ? {
            type: "focus",
            startISO: s.startISO,
            durationMinutes: s.durationMinutes,
            title: "Deep work",
          }
        : { type: s.type };
    const res = await fetch("/api/otter/suggestions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Couldn't do that");
      return;
    }
    track("Otter Suggestion Accepted", { type: s.type });
    remove(s.id);
  }

  if (!items || items.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="text-[var(--color-accent)]" /> Otter noticed
          </span>
        }
        description="A few things worth doing - nothing happens until you say so."
      />
      <CardBody className="space-y-2">
        {error ? <FormError>{error}</FormError> : null}
        {items.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium">{s.title}</p>
              <p className="truncate text-xs text-[var(--color-muted)]">{s.detail}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={() => confirm(s)} disabled={busy === s.id}>
                {busy === s.id ? "…" : CONFIRM_LABEL[s.type]}
              </Button>
              <button
                type="button"
                onClick={() => dismiss(s.id)}
                className="text-xs text-[var(--color-faint)] transition-colors hover:text-[var(--color-muted)]"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
