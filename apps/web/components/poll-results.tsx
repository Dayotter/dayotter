"use client";

import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface PollOptionResult {
  id: string;
  label: string;
  yes: number;
  maybe: number;
  no: number;
  voters: { name: string; response: string }[];
}

/**
 * Host-side results: the share link, a ranked view of each option's votes, and
 * one-tap finalize. The best-supported option is highlighted so the host can
 * lock in the obvious winner fast.
 */
export function PollResults({
  pollId,
  shareUrl,
  sharePath,
  status,
  options,
  finalizedOptionId,
}: {
  pollId: string;
  shareUrl: string;
  sharePath: string;
  status: string;
  options: PollOptionResult[];
  finalizedOptionId: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const isFinalized = status === "finalized";

  // Highlight the leader (most yes, then most maybe) while the poll is open.
  const best = [...options].sort(
    (a, b) => b.yes - a.yes || b.maybe - a.maybe || a.label.localeCompare(b.label),
  )[0];

  async function finalize(optionId: string) {
    setBusy(optionId);
    const res = await fetch(`/api/polls/${pollId}/finalize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
    setBusy(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        title: typeof data.error === "string" ? data.error : "Couldn't finalize",
        variant: "error",
      });
      return;
    }
    toast({ title: "Locked in - everyone who's coming has been notified.", variant: "success" });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!isFinalized ? (
        <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="text-sm text-[var(--color-muted)]">Share to collect votes:</span>
          <code className="min-w-0 flex-1 truncate rounded-sm bg-[var(--color-bg)] px-2 py-1 text-xs">
            {shareUrl}
          </code>
          <CopyLinkButton path={sharePath} />
        </div>
      ) : null}

      <div className="space-y-2">
        {options.map((o) => {
          const isBest = !isFinalized && best?.id === o.id && o.yes + o.maybe > 0;
          const isWinner = isFinalized && finalizedOptionId === o.id;
          return (
            <div
              key={o.id}
              className={`rounded-[var(--radius-lg)] border p-4 ${
                isWinner
                  ? "border-[var(--color-success)] bg-[var(--color-success)]/[0.06]"
                  : isBest
                    ? "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/[0.04]"
                    : "border-[var(--color-border)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    {o.label}
                    {isWinner ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                        <CheckCircle2 size={13} /> Booked
                      </span>
                    ) : isBest ? (
                      <span className="text-xs font-medium text-[var(--color-accent)]">
                        Leading
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex gap-3 text-xs text-[var(--color-muted)]">
                    <span className="text-[var(--color-success)]">{o.yes} yes</span>
                    <span>{o.maybe} maybe</span>
                    <span className="text-[var(--color-faint)]">{o.no} no</span>
                  </p>
                  {o.voters.length > 0 ? (
                    <p className="mt-1.5 text-xs text-[var(--color-faint)]">
                      {o.voters
                        .map((v) => `${v.name} (${v.response})`)
                        .slice(0, 6)
                        .join(", ")}
                      {o.voters.length > 6 ? ` +${o.voters.length - 6}` : ""}
                    </p>
                  ) : null}
                </div>
                {!isFinalized ? (
                  <Button
                    variant={isBest ? "primary" : "outline"}
                    onClick={() => finalize(o.id)}
                    disabled={busy !== null}
                  >
                    {busy === o.id ? "Booking…" : "Pick this"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
