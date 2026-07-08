"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { track } from "@/lib/analytics";
import { Check, Shield } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

interface Suggestion {
  startISO: string;
  endISO: string;
}

/**
 * Deep-work defense — proposes the earliest free block on each of the next few
 * days and lets the user protect it with one tap (writes a focus block to their
 * calendar). Confirm-first: nothing is written until the user clicks Protect.
 */
export function FocusDefense() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [protectedKeys, setProtectedKeys] = useState<Set<string>>(new Set());
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/focus/suggestions")
      .then((r) => r.json())
      .then((d) => active && setSuggestions(d.suggestions ?? []))
      .catch(() => active && setSuggestions([]));
    return () => {
      active = false;
    };
  }, []);

  async function protectBlock(s: Suggestion) {
    setBusyKey(s.startISO);
    setError(null);
    const durationMinutes = Math.round(
      (new Date(s.endISO).getTime() - new Date(s.startISO).getTime()) / 60_000,
    );
    const res = await fetch("/api/focus/block", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startISO: s.startISO, durationMinutes }),
    });
    setBusyKey(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't protect that block");
      return;
    }
    track("Focus Block Protected");
    setProtectedKeys((prev) => new Set(prev).add(s.startISO));
  }

  // Nothing to show until loaded, and hide entirely when there are no gaps.
  if (!suggestions || suggestions.length === 0) return null;

  const visible = suggestions.filter((s) => !protectedKeys.has(s.startISO));

  return (
    <Card className="mb-6">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Shield size={15} className="text-[var(--color-accent)]" /> Protect your focus time
          </span>
        }
        description="Free blocks this week you could hold for deep work."
      />
      <CardBody className="space-y-2">
        {error ? <FormError>{error}</FormError> : null}
        {visible.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">All suggested blocks protected. Nice.</p>
        ) : (
          visible.map((s) => {
            const start = DateTime.fromISO(s.startISO);
            const end = DateTime.fromISO(s.endISO);
            return (
              <div
                key={s.startISO}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-4 py-2.5"
              >
                <div className="text-sm">
                  <span className="font-medium">{start.toFormat("ccc, LLL d")}</span>
                  <span className="text-[var(--color-muted)]">
                    {" · "}
                    {start.toFormat("h:mm a")} – {end.toFormat("h:mm a")}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => protectBlock(s)}
                  disabled={busyKey === s.startISO}
                >
                  <Check size={14} /> {busyKey === s.startISO ? "Protecting…" : "Protect"}
                </Button>
              </div>
            );
          })
        )}
      </CardBody>
    </Card>
  );
}
