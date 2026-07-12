"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateTeamButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      router.push(`/teams/${data.id}`);
      return;
    }
    setError("Couldn't create the team. Please try again.");
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} /> New team
      </Button>
    );
  }
  return (
    <div>
      <form onSubmit={create} className="flex items-end gap-2">
        <div>
          <Label htmlFor="team-name">Team name</Label>
          <Input
            id="team-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Founders"
          />
        </div>
        <Button type="submit" disabled={loading || !name}>
          {loading ? "Creating…" : "Create"}
        </Button>
      </form>
      {error ? (
        <div className="mt-2">
          <FormError>{error}</FormError>
        </div>
      ) : null}
    </div>
  );
}

export function AddMemberForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setEmail("");
      setMsg({ ok: true, text: `Added ${data.name}` });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error ?? "Could not add member" });
    }
  }

  return (
    <form onSubmit={add} className="flex items-end gap-2">
      <div className="flex-1">
        <Label htmlFor="member-email">Add member by email</Label>
        <Input
          id="member-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cofounder@company.com"
        />
      </div>
      <Button type="submit" variant="outline" disabled={loading || !email}>
        <UserPlus size={15} /> Add
      </Button>
      {msg ? (
        <span
          className={`text-sm ${msg.ok ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"}`}
        >
          {msg.text}
        </span>
      ) : null}
    </form>
  );
}

const DURATIONS = [15, 30, 45, 60];

export function CreateTeamEventForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState(30);
  const [type, setType] = useState<"collective" | "round_robin">("collective");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/event-types`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, durationMinutes: duration, schedulingType: type }),
    });
    setLoading(false);
    if (res.ok) {
      setTitle("");
      router.refresh();
    } else {
      setError("Could not create event type");
    }
  }

  return (
    <form onSubmit={create} className="space-y-4">
      <div>
        <Label htmlFor="te-title">Event title</Label>
        <Input
          id="te-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Team intro call"
        />
      </div>
      <div className="flex flex-wrap gap-6">
        <div>
          <Label htmlFor="te-duration">Duration</Label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={
                  d === duration
                    ? "rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 text-sm"
                    : "rounded-md border border-[var(--color-border-strong)] px-3 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }
              >
                {d}m
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="te-type">Scheduling</Label>
          <div className="flex gap-2">
            {(
              [
                { v: "collective", label: "Collective", hint: "All free" },
                { v: "round_robin", label: "Round-robin", hint: "Distribute" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setType(o.v)}
                className={
                  type === o.v
                    ? "rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-2 text-left text-sm"
                    : "rounded-md border border-[var(--color-border-strong)] px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                }
              >
                <div className="font-medium text-[var(--color-text)]">{o.label}</div>
                <div className="text-xs text-[var(--color-muted)]">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" disabled={loading || !title}>
        {loading ? "Creating…" : "Create team event"}
      </Button>
    </form>
  );
}
