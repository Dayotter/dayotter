"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { track } from "@/lib/analytics";
import { AlertTriangle, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

interface Invite {
  connectionId: string;
  calendarExternalId: string;
  externalEventId: string;
  title: string;
  startISO: string;
  endISO: string;
  organizerName: string | null;
  hasConflict: boolean;
}

type Response = "accepted" | "declined" | "tentative";
const SUGGEST_LABEL: Record<Response, string> = {
  accepted: "Accept",
  declined: "Decline",
  tentative: "Maybe",
};

/**
 * Pending calendar invitations with accept / decline / tentative actions and an
 * optional AI suggestion. The AI only advises — the user clicks the action.
 */
export function PendingInvites({ aiEnabled }: { aiEnabled: boolean }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [suggestKey, setSuggestKey] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, { suggestion: Response; reasoning: string }>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/invites")
      .then((r) => r.json())
      .then((d) => active && setInvites(d.invites ?? []))
      .catch(() => active && setInvites([]));
    return () => {
      active = false;
    };
  }, []);

  async function respond(inv: Invite, response: Response) {
    setBusyKey(inv.externalEventId);
    setError(null);
    const res = await fetch("/api/invites/respond", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        connectionId: inv.connectionId,
        calendarExternalId: inv.calendarExternalId,
        externalEventId: inv.externalEventId,
        response,
      }),
    });
    setBusyKey(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't send your response");
      return;
    }
    track("Invite Responded", { response });
    setInvites((prev) => (prev ?? []).filter((i) => i.externalEventId !== inv.externalEventId));
  }

  async function suggest(inv: Invite) {
    setSuggestKey(inv.externalEventId);
    setError(null);
    const whenText = DateTime.fromISO(inv.startISO).toFormat("ccc, LLL d 'at' h:mm a");
    const res = await fetch("/api/ai/invite/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: inv.title,
        whenText,
        organizer: inv.organizerName ?? "unknown",
        hasConflict: inv.hasConflict,
      }),
    });
    setSuggestKey(null);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't get a suggestion");
      return;
    }
    setSuggestions((prev) => ({ ...prev, [inv.externalEventId]: data.triage }));
  }

  if (!invites || invites.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader title="Pending invitations" description="Respond to invites from your connected calendars." />
      <CardBody className="space-y-3">
        {error ? <FormError>{error}</FormError> : null}
        {invites.map((inv) => {
          const start = DateTime.fromISO(inv.startISO);
          const end = DateTime.fromISO(inv.endISO);
          const s = suggestions[inv.externalEventId];
          return (
            <div key={inv.externalEventId} className="rounded-md border border-[var(--color-border)] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inv.title}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {start.toFormat("ccc, LLL d · h:mm a")} – {end.toFormat("h:mm a")}
                    {inv.organizerName ? ` · from ${inv.organizerName}` : ""}
                  </p>
                  {inv.hasConflict ? (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--color-amber)]">
                      <AlertTriangle size={12} /> Conflicts with your schedule
                    </span>
                  ) : null}
                </div>
              </div>

              {s ? (
                <p className="mt-2 rounded-sm bg-[var(--color-accent-soft)] px-3 py-2 text-xs text-[var(--color-accent)]">
                  AI suggests <strong>{SUGGEST_LABEL[s.suggestion]}</strong> — {s.reasoning}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => respond(inv, "accepted")} disabled={busyKey === inv.externalEventId}>
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => respond(inv, "tentative")} disabled={busyKey === inv.externalEventId}>
                  Maybe
                </Button>
                <Button size="sm" variant="ghost" onClick={() => respond(inv, "declined")} disabled={busyKey === inv.externalEventId}>
                  Decline
                </Button>
                {aiEnabled && !s ? (
                  <button
                    type="button"
                    onClick={() => suggest(inv)}
                    disabled={suggestKey === inv.externalEventId}
                    className="ml-auto inline-flex items-center gap-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    <Sparkles size={13} className="text-[var(--color-accent)]" />
                    {suggestKey === inv.externalEventId ? "Thinking…" : "Ask AI"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
