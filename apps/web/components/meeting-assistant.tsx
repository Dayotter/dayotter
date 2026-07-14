"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { MessageSquare, Sparkles } from "lucide-react";
import { useState } from "react";

/**
 * AI meeting assistant - the host describes what to say about a meeting, the AI
 * drafts a short message, and the host reviews/edits before sending. Confirm-
 * first: nothing is sent until the host clicks Send.
 */
export function MeetingAssistant({ uid, title }: { uid: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft(e: React.FormEvent) {
    e.preventDefault();
    setDrafting(true);
    setError(null);
    setSent(false);
    setMessage("");
    const res = await fetch(`/api/ai/meeting/${uid}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    setDrafting(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't draft that");
      return;
    }
    track("AI Meeting Draft", { understood: data.reply?.understood });
    if (!data.reply?.understood) {
      setError(data.reply?.message || "I can only help with messages about this meeting.");
      return;
    }
    setMessage(data.reply.message);
  }

  async function send() {
    setSending(true);
    setError(null);
    const res = await fetch(`/api/ai/meeting/${uid}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    setSending(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't send");
      return;
    }
    track("AI Meeting Message Sent");
    setMessage("");
    setInstruction("");
    setSent(true);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <Sparkles size={14} className="text-[var(--color-accent)]" /> Ask AI to message attendees
      </button>
    );
  }

  return (
    <Card className="mb-6">
      <CardBody className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquare size={15} className="text-[var(--color-accent)]" />
          <p className="text-sm font-medium">Message attendees of "{title}"</p>
          <span className="text-xs text-[var(--color-faint)]">- you review before it sends</span>
        </div>

        <form onSubmit={draft} className="flex gap-2">
          <Input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Ask if we can push to 3pm"
            required
          />
          <Button type="submit" disabled={drafting || !instruction.trim()}>
            {drafting ? "Drafting…" : "Draft"}
          </Button>
        </form>

        {error ? (
          <div className="mt-3">
            <FormError>{error}</FormError>
          </div>
        ) : null}
        {sent ? (
          <div className="mt-3">
            <FormSuccess>Message sent to attendees.</FormSuccess>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <p className="text-xs text-[var(--color-faint)]">Review &amp; edit, then send</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={send} disabled={sending || !message.trim()}>
                {sending ? "Sending…" : "Send to attendees"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMessage("")} disabled={sending}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
