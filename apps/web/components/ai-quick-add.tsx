"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { useSpeechInput } from "@/lib/use-speech";
import { Mic, Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Intent = "create" | "reschedule" | "cancel" | "none";

interface Draft {
  understood: boolean;
  intent: Intent;
  kind: "meeting" | "focus" | "reminder";
  title: string;
  startISO: string;
  durationMinutes: number;
  attendees: { name: string; email: string }[];
  notes: string;
  bookingRef: number;
  newStartISO: string;
  message: string;
}
interface Target {
  uid: string;
  title: string;
  startISO: string;
}

const KIND_LABEL: Record<Draft["kind"], string> = {
  meeting: "Meeting",
  focus: "Focus block",
  reminder: "Reminder",
};

function toLocalInput(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return (dt.isValid ? dt : DateTime.now()).toFormat("yyyy-MM-dd'T'HH:mm");
}
function fmtWhen(iso: string): string {
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat("ccc, LLL d 'at' h:mm a") : iso;
}

/**
 * AI command bar — natural language → an editable draft the user confirms before
 * anything happens. Handles creating, rescheduling, and cancelling. The AI only
 * proposes; the human always confirms.
 */
export function AiQuickAdd() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [matchedType, setMatchedType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Editable create fields.
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  // Editable reschedule field.
  const [newStartLocal, setNewStartLocal] = useState("");

  function reset() {
    setDraft(null);
    setTarget(null);
    setMatchedType(null);
  }

  // Speak-to-type: fill the box and run the command in one step.
  const speech = useSpeechInput((transcript) => {
    setText(transcript);
    void makeDraft(undefined, transcript);
  });

  async function makeDraft(e?: React.FormEvent, override?: string) {
    e?.preventDefault();
    const input = (override ?? text).trim();
    if (!input) return;
    setLoading(true);
    setError(null);
    setDone(null);
    reset();
    const res = await fetch("/api/ai/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong");
      return;
    }
    const d = data.draft as Draft;
    track("AI Command Drafted", { intent: d.intent, understood: d.understood });
    if (!d.understood || d.intent === "none") {
      setError(d.message || "I can only help with scheduling.");
      return;
    }
    setDraft(d);
    setTarget((data.target as Target | null) ?? null);
    setMatchedType((data.matchedEventType as { title?: string } | null)?.title ?? null);
    if (d.intent === "create") {
      setTitle(d.title);
      setStartLocal(toLocalInput(d.startISO));
      setDuration(d.durationMinutes);
      setNotes(d.notes);
    } else if (d.intent === "reschedule") {
      setNewStartLocal(toLocalInput(d.newStartISO));
    }
  }

  async function confirmCreate() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    const startISO = DateTime.fromFormat(startLocal, "yyyy-MM-dd'T'HH:mm").toISO();
    const res = await fetch("/api/ai/schedule/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        startISO,
        durationMinutes: duration,
        notes: notes || undefined,
        attendees: draft.attendees,
      }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't add the event");
      return;
    }
    track("AI Event Added", { kind: draft.kind });
    finish("Added to your calendar.");
  }

  async function confirmReschedule() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const startISO = DateTime.fromFormat(newStartLocal, "yyyy-MM-dd'T'HH:mm").toISO();
    const res = await fetch(`/api/bookings/${target.uid}/reschedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ start: startISO }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't reschedule that meeting");
      return;
    }
    track("AI Reschedule Confirmed");
    finish("Meeting rescheduled — attendees notified.");
  }

  async function confirmCancel() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${target.uid}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't cancel that meeting");
      return;
    }
    track("AI Cancel Confirmed");
    finish("Meeting cancelled — attendees notified.");
  }

  function finish(msg: string) {
    reset();
    setText("");
    setDone(msg);
    router.refresh();
  }

  return (
    <Card className="mb-6">
      <CardBody className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <p className="text-sm font-medium">Ask calSync</p>
          <span className="text-xs text-[var(--color-faint)]">
            — you confirm before anything changes
          </span>
        </div>

        <form onSubmit={makeDraft} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              speech.listening
                ? "Listening…"
                : "e.g. Move my 3pm to tomorrow, or block 2 hours for deep work"
            }
          />
          {speech.supported ? (
            <button
              type="button"
              onClick={speech.toggle}
              aria-label={speech.listening ? "Stop listening" : "Speak a command"}
              aria-pressed={speech.listening}
              title="Speak a command"
              className={
                speech.listening
                  ? "flex w-11 shrink-0 items-center justify-center rounded-md border border-[var(--color-danger)] bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                  : "flex w-11 shrink-0 items-center justify-center rounded-md border border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }
            >
              <Mic size={16} className={speech.listening ? "animate-pulse" : undefined} />
            </button>
          ) : null}
          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? "Thinking…" : "Go"}
          </Button>
        </form>

        {error ? (
          <div className="mt-3">
            <FormError>{error}</FormError>
          </div>
        ) : null}
        {done ? (
          <div className="mt-3">
            <FormSuccess>{done}</FormSuccess>
          </div>
        ) : null}

        {draft?.intent === "create" ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                {KIND_LABEL[draft.kind]}
              </span>
              {matchedType ? (
                <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-xs text-[var(--color-muted)]">
                  via {matchedType}
                </span>
              ) : null}
              <span className="text-xs text-[var(--color-faint)]">
                Review &amp; edit, then confirm
              </span>
            </div>
            <div>
              <Label htmlFor="ai-title">Title</Label>
              <Input id="ai-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ai-start">Starts</Label>
                <Input
                  id="ai-start"
                  type="datetime-local"
                  value={startLocal}
                  onChange={(e) => setStartLocal(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="ai-duration">Duration (min)</Label>
                <Input
                  id="ai-duration"
                  type="number"
                  min={5}
                  max={1440}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 30)}
                />
              </div>
            </div>
            {draft.attendees.length > 0 ? (
              <p className="text-xs text-[var(--color-muted)]">
                With: {draft.attendees.map((a) => a.name || a.email).join(", ")}
              </p>
            ) : null}
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={confirmCreate} disabled={busy}>
                {busy ? "Adding…" : "Add to calendar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        {draft?.intent === "reschedule" && target ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                Reschedule
              </span>
              <span className="text-xs text-[var(--color-faint)]">Confirm the new time</span>
            </div>
            <p className="text-sm">
              Move <strong>{target.title}</strong> from{" "}
              <span className="text-[var(--color-muted)]">{fmtWhen(target.startISO)}</span> to:
            </p>
            <Input
              type="datetime-local"
              value={newStartLocal}
              onChange={(e) => setNewStartLocal(e.target.value)}
            />
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={confirmReschedule} disabled={busy}>
                {busy ? "Rescheduling…" : "Reschedule"}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        {draft?.intent === "cancel" && target ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-danger)]/15 px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">
                Cancel
              </span>
              <span className="text-xs text-[var(--color-faint)]">This notifies attendees</span>
            </div>
            <p className="text-sm">
              Cancel <strong>{target.title}</strong> on{" "}
              <span className="text-[var(--color-muted)]">{fmtWhen(target.startISO)}</span>?
            </p>
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="danger" onClick={confirmCancel} disabled={busy}>
                {busy ? "Cancelling…" : "Cancel meeting"}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={busy}>
                Keep it
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
