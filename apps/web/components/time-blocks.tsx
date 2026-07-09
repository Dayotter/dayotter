"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { Brain, MapPin, Trash2, User } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

type Kind = "focus" | "personal" | "travel" | "other";
interface Block {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
}

const KIND_ICON: Record<string, typeof Brain> = {
  focus: Brain,
  personal: User,
  travel: MapPin,
  other: User,
};
const KINDS: Kind[] = ["focus", "personal", "travel", "other"];

/** Planning Engine: personal / focus blocks that protect the user's calendar
 *  from bookings (they count as busy in the availability engine). */
export function TimeBlocks() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("focus");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/time-blocks")
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks ?? []))
      .catch(() => {});
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const startISO = DateTime.fromFormat(start, "yyyy-MM-dd'T'HH:mm").toISO();
    const endISO = DateTime.fromFormat(end, "yyyy-MM-dd'T'HH:mm").toISO();
    if (!startISO || !endISO || endISO <= startISO) {
      setError("Pick a start and a later end time.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/time-blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, kind, startsAt: startISO, endsAt: endISO }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't add that block");
      return;
    }
    track("Time Block Created", { kind });
    setBlocks((prev) => [...prev, data.block].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    setTitle("");
    setStart("");
    setEnd("");
  }

  async function remove(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
    await fetch(`/api/time-blocks/${id}`, { method: "DELETE" });
  }

  return (
    <Card className="mt-8">
      <CardHeader
        title="Personal & focus blocks"
        description="Protect time on your calendar — bookers can't schedule over these."
      />
      <CardBody className="space-y-4">
        {blocks.length > 0 ? (
          <ul className="space-y-2">
            {blocks.map((b) => {
              const Icon = KIND_ICON[b.kind] ?? User;
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-4 py-2.5"
                >
                  <Icon size={16} className="text-[var(--color-accent)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{b.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {DateTime.fromISO(b.startsAt).toFormat("ccc, LLL d · h:mm a")} –{" "}
                      {DateTime.fromISO(b.endsAt).toFormat("h:mm a")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(b.id)}
                    aria-label="Remove block"
                    className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No blocks yet. Add focus time, lunch, travel, or personal appointments below.
          </p>
        )}

        <form onSubmit={add} className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <div>
              <Label htmlFor="tb-title">Title</Label>
              <Input
                id="tb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Deep work"
                required
              />
            </div>
            <div>
              <Label htmlFor="tb-kind">Type</Label>
              <Select id="tb-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k[0]!.toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tb-start">Starts</Label>
              <Input
                id="tb-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="tb-end">Ends</Label>
              <Input
                id="tb-end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Adding…" : "Add block"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
