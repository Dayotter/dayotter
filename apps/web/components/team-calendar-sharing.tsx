"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Check, Copy, Link2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Owner/admin control for the team's public availability calendar. Generates an
 * unguessable share link (rotating it revokes old links), lets you copy it, and
 * turns it off. The link renders a read-only busy/free view - no titles or emails.
 */
export function TeamCalendarSharing({
  teamId,
  teamSlug,
  initialToken,
}: {
  teamId: string;
  teamSlug: string;
  initialToken: string | null;
}) {
  const { toast } = useToast();
  const [token, setToken] = useState<string | null>(initialToken);
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);
  const url = token ? `${origin}/team/${teamSlug}/calendar/${token}` : "";
  const embedCode = token
    ? `<iframe src="${origin}/embed/team/${teamSlug}/calendar/${token}" style="width:100%;border:0;min-height:520px" loading="lazy" title="Team availability"></iframe>`
    : "";

  async function generate() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/share`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.token) {
      toast({ title: "Couldn't create the link", variant: "error" });
      return;
    }
    setToken(data.token);
    toast({
      title: token ? "New link generated - old one revoked" : "Share link created",
      variant: "success",
    });
  }

  async function revoke() {
    setBusy(true);
    const res = await fetch(`/api/teams/${teamId}/share`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      toast({ title: "Couldn't turn off sharing", variant: "error" });
      return;
    }
    setToken(null);
    toast({ title: "Sharing turned off", variant: "success" });
  }

  async function copyEmbed() {
    if (!embedCode) return;
    await navigator.clipboard.writeText(embedCode).catch(() => {});
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 1500);
  }

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!token) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--color-muted)]">
          Share a read-only view of when the team is busy over the next 7 days. Anyone with the link
          can see availability - no titles or emails are shown.
        </p>
        <Button size="sm" onClick={generate} disabled={busy}>
          <Link2 size={15} /> {busy ? "Creating…" : "Create share link"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input readOnly value={url} aria-label="Public team calendar link" className="flex-1" />
        <Button size="sm" variant="outline" onClick={copy}>
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-muted)]">Embed on your site</span>
          <button
            type="button"
            onClick={copyEmbed}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
          >
            {copiedEmbed ? <Check size={13} /> : <Copy size={13} />}
            {copiedEmbed ? "Copied" : "Copy code"}
          </button>
        </div>
        <pre className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2 text-[11px] text-[var(--color-muted)]">
          <code>{embedCode}</code>
        </pre>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" onClick={generate} disabled={busy}>
          Regenerate
        </Button>
        <Button size="sm" variant="ghost" onClick={revoke} disabled={busy}>
          <Trash2 size={15} /> Turn off
        </Button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Regenerating makes a new link and immediately breaks the old one.
      </p>
    </div>
  );
}
