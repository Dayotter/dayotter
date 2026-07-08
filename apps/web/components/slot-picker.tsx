"use client";
import { FormError } from "@/components/ui/form";

import { type Slot, SlotGrid, useLocalZone } from "@/components/slot-grid";
import { Turnstile, captchaEnabled } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import type { BookingQuestionInput } from "@/lib/booking/event-type-input";
import { ArrowLeft } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SlotPicker({
  eventTypeId,
  questions = [],
}: {
  eventTypeId: string;
  questions?: BookingQuestionInput[];
}) {
  const router = useRouter();
  const zone = useLocalZone();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(id: string, value: string | boolean) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    // Client-side required-answer check (server re-validates).
    const missing = questions.find((q) => {
      if (!q.required) return false;
      const v = answers[q.id];
      return q.type === "checkbox" ? v !== true : !v || String(v).trim() === "";
    });
    if (missing) {
      setError(`Please answer: ${missing.label}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventTypeId,
        start: selected.start,
        attendee: { name, email, timezone: zone },
        notes: notes || undefined,
        responses: questions.length ? answers : undefined,
        captchaToken: captchaToken || undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitting(false);
      track("Booking Failed", { eventTypeId, status: res.status });
      setError(typeof data.error === "string" ? data.error : "Could not confirm booking");
      return;
    }
    const data = await res.json();
    track("Booking Confirmed", { eventTypeId });
    router.push(data.url as `/${string}`);
  }

  if (!selected) return <SlotGrid eventTypeId={eventTypeId} onSelect={setSelected} />;

  return (
    <form onSubmit={confirm}>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={15} /> Back
      </button>
      <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
        {DateTime.fromISO(selected.start).setZone(zone).toFormat("cccc, LLLL d 'at' h:mm a")}
        <span className="text-[var(--color-muted)]"> · {zone}</span>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="b-name">Your name</Label>
          <Input
            id="b-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </div>
        <div>
          <Label htmlFor="b-email">Email</Label>
          <Input
            id="b-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <Label htmlFor="b-notes">Notes (optional)</Label>
          <textarea
            id="b-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything to share before the meeting?"
            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
        </div>
        {questions.map((q) => {
          const fieldId = `q-${q.id}`;
          if (q.type === "checkbox") {
            return (
              <label key={q.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={answers[q.id] === true}
                  onChange={(e) => setAnswer(q.id, e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                {q.label}
                {q.required ? <span className="text-[var(--color-danger)]">*</span> : null}
              </label>
            );
          }
          return (
            <div key={q.id}>
              <Label htmlFor={fieldId}>
                {q.label}
                {q.required ? <span className="text-[var(--color-danger)]"> *</span> : null}
              </Label>
              {q.type === "textarea" ? (
                <textarea
                  id={fieldId}
                  rows={3}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                />
              ) : q.type === "select" ? (
                <Select
                  id={fieldId}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                >
                  <option value="" disabled>
                    Select…
                  </option>
                  {(q.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={fieldId}
                  type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <Turnstile onToken={setCaptchaToken} />
        <FormError>{error}</FormError>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || (captchaEnabled && !captchaToken)}
        >
          {submitting ? "Confirming…" : "Confirm booking"}
        </Button>
      </div>
    </form>
  );
}
