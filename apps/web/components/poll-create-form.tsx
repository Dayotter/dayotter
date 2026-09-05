"use client";

import { Button } from "@/components/ui/button";
import { DateTimeField } from "@/components/ui/datetime-field";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { Globe2, Mail, Plus, X } from "lucide-react";
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
  const [votingMode, setVotingMode] = useState<"public" | "invited">("public");
  const [invitees, setInvitees] = useState("");
  const [message, setMessage] = useState("");
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
    const inviteeEmails = [
      ...new Set(
        invitees
          .split(/[\s,;]+/)
          .map((email) => email.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    if (votingMode === "invited") {
      if (inviteeEmails.length === 0) return setError("Add at least one email recipient.");
      if (inviteeEmails.some((email) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        return setError("Check that every recipient has a valid email address.");
      }
      if (inviteeEmails.length > 100) return setError("A poll can invite at most 100 people.");
    }

    setSubmitting(true);
    const res = await fetch("/api/polls", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        durationMinutes: duration,
        location,
        times: iso,
        votingMode,
        inviteeEmails: votingMode === "invited" ? inviteeEmails : undefined,
        message: message.trim() || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not create poll");
      return;
    }
    const data = await res.json();
    toast({
      title:
        votingMode === "invited"
          ? data.emailFailures > 0
            ? `Poll created, but ${data.emailFailures} invitation${data.emailFailures === 1 ? "" : "s"} could not be sent.`
            : `Poll created and sent to ${data.invitedCount} recipient${data.invitedCount === 1 ? "" : "s"}.`
          : "Poll created - share the public link to collect votes.",
      variant: data.emailFailures > 0 ? "error" : "success",
    });
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

      <fieldset>
        <legend className="text-sm font-medium text-[var(--color-text)]">Who can vote?</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {[
            {
              value: "public" as const,
              title: "Public link",
              description: "Anyone with the link enters their name and email.",
              icon: Globe2,
            },
            {
              value: "invited" as const,
              title: "Email invitations",
              description: "Only invited recipients can vote using their personal link.",
              icon: Mail,
            },
          ].map((choice) => {
            const Icon = choice.icon;
            const selected = votingMode === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setVotingMode(choice.value)}
                className={`rounded-[var(--radius-lg)] border p-4 text-left transition-colors ${
                  selected
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)]"
                    : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Icon size={16} /> {choice.title}
                </span>
                <span className="mt-1 block text-xs text-[var(--color-muted)]">
                  {choice.description}
                </span>
              </button>
            );
          })}
        </div>
        {votingMode === "invited" ? (
          <div className="mt-4">
            <Label htmlFor="poll-invitees">Recipient emails</Label>
            <Textarea
              id="poll-invitees"
              value={invitees}
              onChange={(event) => setInvitees(event.target.value)}
              placeholder={"alex@example.com\nsam@example.com"}
              rows={4}
            />
            <p className="mt-1.5 text-xs text-[var(--color-faint)]">
              Separate addresses with commas, spaces, or new lines. Each person receives a unique
              voting link.
            </p>
          </div>
        ) : null}
      </fieldset>

      <div>
        <Label htmlFor="poll-message">
          Message to invitees{" "}
          <span className="font-normal text-[var(--color-faint)]">(optional)</span>
        </Label>
        <Textarea
          id="poll-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={3}
          placeholder="e.g. Here's the agenda for our call — let me know which times work."
        />
        <p className="mt-1.5 text-xs text-[var(--color-faint)]">
          Sent with the invitation emails and shown on the poll page - handy when you share the
          public link yourself instead.
        </p>
      </div>

      <div>
        <Label>Propose some times</Label>
        <p className="mb-2 text-xs text-[var(--color-faint)]">
          Invitees vote on which work. Times are in your local timezone.
        </p>
        <div className="space-y-2">
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <DateTimeField
                value={t}
                onChange={(v) => setTime(i, v)}
                className="flex-1"
                aria-label={`Proposed time ${i + 1}`}
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
