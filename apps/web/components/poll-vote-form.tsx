"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Check, Minus, X } from "lucide-react";
import { DateTime } from "luxon";
import { useMemo, useState } from "react";

type Response = "yes" | "no" | "maybe";
const CHOICES: { value: Response; label: string; icon: typeof Check }[] = [
  { value: "yes", label: "Yes", icon: Check },
  { value: "maybe", label: "Maybe", icon: Minus },
  { value: "no", label: "No", icon: X },
];

export function PollVoteForm({
  token,
  options,
}: {
  token: string;
  options: { id: string; startISO: string }[];
}) {
  const zone = useMemo(() => DateTime.local().zoneName, []);
  const rows = useMemo(
    () =>
      options.map((o) => ({
        id: o.id,
        label: DateTime.fromISO(o.startISO).setZone(zone).toFormat("ccc, LLL d · h:mm a"),
      })),
    [options, zone],
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function pick(optionId: string, value: Response) {
    setResponses((prev) => ({ ...prev, [optionId]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const chosen = Object.entries(responses).map(([optionId, response]) => ({
      optionId,
      response,
    }));
    if (!name.trim() || !email.includes("@")) return setError("Enter your name and email.");
    if (chosen.length === 0) return setError("Mark your availability for at least one time.");

    setSubmitting(true);
    const res = await fetch(`/api/poll/${token}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), responses: chosen }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Couldn't submit your vote");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-success)]/40 bg-[var(--color-success)]/[0.06] p-6 text-center">
        <Check className="mx-auto mb-2 text-[var(--color-success)]" size={28} />
        <p className="font-medium">Thanks, {name.split(" ")[0]}!</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Your availability is in. The organizer will confirm the final time by email.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="v-name">Your name</Label>
          <Input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="v-email">Email</Label>
          <Input
            id="v-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
        </div>
      </div>

      <p className="text-xs text-[var(--color-faint)]">Times shown in {zone}</p>
      <div className="space-y-2">
        {rows.map((o) => (
          <div
            key={o.id}
            className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="text-sm font-medium">{o.label}</span>
            <div className="flex gap-1.5">
              {CHOICES.map((c) => {
                const active = responses[o.id] === c.value;
                const Icon = c.icon;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => pick(o.id, c.value)}
                    className={`inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
                        : "border-[var(--color-border-strong)] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon size={14} /> {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit availability"}
      </Button>
    </form>
  );
}
