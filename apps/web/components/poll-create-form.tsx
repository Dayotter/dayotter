"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const LOCATIONS = [
  { value: "google_meet", label: "Google Meet" },
  { value: "zoom", label: "Zoom" },
  { value: "phone", label: "Phone" },
  { value: "custom", label: "Other / in person" },
];

/** Two sensible default rows so the host starts with something to fill in. */
function seedRows(): string[] {
  return ["", ""];
}

export function PollCreateForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("google_meet");
  const [times, setTimes] = useState<string[]>(seedRows);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setTime(i: number, v: string) {
    setTimes((prev) => prev.map((t, j) => (j === i ? v : t)));
  }
  function addRow() {
    setTimes((prev) => (prev.length >= 20 ? prev : [...prev, ""]));
  }
  function removeRow(i: number) {
    setTimes((prev) => (prev.length <= 2 ? prev : prev.filter((_, j) => j !== i)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // datetime-local values are local wall-clock - convert to ISO instants.
    const iso = times
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => new Date(t).toISOString());
    if (!title.trim()) return setError("Give your poll a title.");
    if (iso.length < 2) return setError("Add at least two time options.");

    setSubmitting(true);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        durationMinutes: duration,
        location,
        times: iso,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not create poll");
      return;
    }
    const data = await res.json();
    toast({ title: "Poll created - share the link to collect votes.", variant: "success" });
    router.push(data.url as `/${string}`);
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      <div>
        <Label htmlFor="poll-title">What's the meeting?</Label>
        <Input
          id="poll-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Q3 planning sync"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="poll-duration">Duration</Label>
          <Select
            id="poll-duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[15, 30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="poll-location">Location</Label>
          <Select id="poll-location" value={location} onChange={(e) => setLocation(e.target.value)}>
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Propose some times</Label>
        <p className="mb-2 text-xs text-[var(--color-faint)]">
          Invitees vote on which work. Times are in your local timezone.
        </p>
        <div className="space-y-2">
          {times.map((t, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and reorder-free
            <div key={i} className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={t}
                onChange={(e) => setTime(i, e.target.value)}
                className="h-10 flex-1 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={times.length <= 2}
                aria-label="Remove time"
                className="rounded-md p-2 text-[var(--color-faint)] hover:text-[var(--color-danger)] disabled:opacity-30"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={times.length >= 20}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline disabled:opacity-40"
        >
          <Plus size={15} /> Add another time
        </button>
      </div>

      <FormError>{error}</FormError>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Creating…" : "Create poll"}
      </Button>
    </form>
  );
}
