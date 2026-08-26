"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { CalendarPlus, Check } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DURATIONS = [15, 30, 45, 60];

type Member = { id: string; name: string; isSelf: boolean };

/**
 * Schedule an internal meeting across the team. The organiser (the signed-in
 * member) is always included; pick any internal-bookable teammates. Booking
 * overrides anyone who's busy, so a conflict preview is shown first.
 */
export function InternalTeamBookingForm({
  teamId,
  members,
}: {
  teamId: string;
  members: Member[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [startLocal, setStartLocal] = useState("");
  const [duration, setDuration] = useState(30);
  const [selected, setSelected] = useState<string[]>(members.map((m) => m.id));
  const [conflicts, setConflicts] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "booking">("idle");

  function toggle(id: string, isSelf: boolean) {
    if (isSelf) return; // the organiser is always a host
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setConflicts(null);
  }

  function startISO(): string | null {
    const dt = DateTime.fromFormat(startLocal, "yyyy-MM-dd'T'HH:mm");
    return dt.isValid ? dt.toISO() : null;
  }

  async function call(dryRun: boolean) {
    const iso = startISO();
    if (!title.trim() || !iso) {
      toast({ title: "Add a title and a start time", variant: "error" });
      return;
    }
    setPhase(dryRun ? "checking" : "booking");
    const res = await fetch(`/api/teams/${teamId}/internal-booking`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        startISO: iso,
        durationMinutes: duration,
        memberIds: selected,
        dryRun,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setPhase("idle");
    if (!res.ok) {
      toast({ title: "Something went wrong", description: data.error, variant: "error" });
      return;
    }
    const names = (data.conflicts ?? []).map((c: { name: string }) => c.name);
    if (dryRun) {
      setConflicts(names);
      if (names.length === 0) toast({ title: "Everyone's free at that time", variant: "success" });
      return;
    }
    toast({
      title: "Team meeting booked",
      description: names.length ? `${names.join(", ")} were double-booked` : undefined,
      variant: "success",
    });
    setTitle("");
    setStartLocal("");
    setConflicts(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="itb-title">Meeting title</Label>
        <Input
          id="itb-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Founders sync"
        />
      </div>
      <div className="flex flex-wrap gap-4">
        <div>
          <Label htmlFor="itb-start">Starts</Label>
          <Input
            id="itb-start"
            type="datetime-local"
            value={startLocal}
            onChange={(e) => {
              setStartLocal(e.target.value);
              setConflicts(null);
            }}
          />
        </div>
        <div>
          <Label htmlFor="itb-dur">Duration</Label>
          <div className="flex gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setDuration(d);
                  setConflicts(null);
                }}
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
      </div>
      <div>
        <Label htmlFor="itb-who">Who's in it</Label>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const active = selected.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                disabled={m.isSelf}
                onClick={() => toggle(m.id, m.isSelf)}
                className={
                  active
                    ? "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent-soft)] px-3 py-1.5 text-xs font-medium text-[var(--color-accent)] disabled:opacity-70"
                    : "inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-strong)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
                }
              >
                {active ? <Check size={13} /> : null}
                {m.name}
                {m.isSelf ? " (you)" : ""}
              </button>
            );
          })}
        </div>
      </div>
      {conflicts && conflicts.length > 0 ? (
        <p className="rounded-md border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/10 px-3 py-2 text-xs text-[var(--color-text)]">
          Busy at that time: <span className="font-medium">{conflicts.join(", ")}</span>. Booking
          will schedule over their commitments.
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => call(true)} disabled={phase !== "idle"}>
          {phase === "checking" ? "Checking…" : "Check availability"}
        </Button>
        <Button size="sm" onClick={() => call(false)} disabled={phase !== "idle"}>
          <CalendarPlus size={15} /> {phase === "booking" ? "Booking…" : "Book meeting"}
        </Button>
      </div>
    </div>
  );
}
