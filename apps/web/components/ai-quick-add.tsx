"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { FormError, FormSuccess } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { track } from "@/lib/analytics";
import { Sparkles } from "lucide-react";
import { DateTime } from "luxon";
import { useState } from "react";

interface Draft {
  understood: boolean;
  kind: "meeting" | "focus" | "reminder";
  title: string;
  startISO: string;
  durationMinutes: number;
  attendees: { name: string; email: string }[];
  notes: string;
  message: string;
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

/**
 * AI quick-add — natural language → an editable draft the user confirms before
 * anything is written. The AI only proposes; the human always confirms.
 */
export function AiQuickAdd() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(30);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  async function makeDraft(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreated(false);
    setDraft(null);
    const res = await fetch("/api/ai/schedule", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Something went wrong");
      return;
    }
    const d = data.draft as Draft;
    track("AI Draft Created", { kind: d.kind, understood: d.understood });
    if (!d.understood) {
      setError(d.message || "I can only help with scheduling.");
      return;
    }
    setDraft(d);
    setTitle(d.title);
    setStartLocal(toLocalInput(d.startISO));
    setDuration(d.durationMinutes);
    setNotes(d.notes);
  }

  async function addToCalendar() {
    if (!draft) return;
    setCreating(true);
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
    setCreating(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't add the event");
      return;
    }
    track("AI Event Added", { kind: draft.kind });
    setDraft(null);
    setText("");
    setCreated(true);
  }

  return (
    <Card className="mb-6">
      <CardBody className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <p className="text-sm font-medium">Quick add with AI</p>
          <span className="text-xs text-[var(--color-faint)]">— you confirm before anything's added</span>
        </div>

        <form onSubmit={makeDraft} className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Block 2 hours for deep work tomorrow morning"
            required
          />
          <Button type="submit" disabled={loading || !text.trim()}>
            {loading ? "Thinking…" : "Draft"}
          </Button>
        </form>

        {error ? <div className="mt-3"><FormError>{error}</FormError></div> : null}
        {created ? (
          <div className="mt-3">
            <FormSuccess>Added to your calendar.</FormSuccess>
          </div>
        ) : null}

        {draft ? (
          <div className="mt-4 space-y-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-accent)]">
                {KIND_LABEL[draft.kind]}
              </span>
              <span className="text-xs text-[var(--color-faint)]">Review &amp; edit, then confirm</span>
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
              <Button size="sm" onClick={addToCalendar} disabled={creating}>
                {creating ? "Adding…" : "Add to calendar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={creating}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
