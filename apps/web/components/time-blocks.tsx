"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { Brain, MapPin, Repeat, Trash2, User } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

type Kind = "focus" | "personal" | "travel" | "other";
interface Block {
  id: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  seriesId?: string | null;
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
  const [repeatWeeks, setRepeatWeeks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/time-blocks")
      .then((r) => r.json())
      .then((d) => setBlocks(d.blocks ?? []))
      .catch(() => {});
  }
  useEffect(load, []);

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
      body: JSON.stringify({
        title,
        kind,
        startsAt: startISO,
        endsAt: endISO,
        repeatWeeks,
        timezone: DateTime.local().zoneName ?? "UTC",
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't add that block");
      return;
    }
    track("Time Block Created", { kind, recurring: repeatWeeks > 0 });
    // A recurring block creates several rows - reload to show the collapsed series.
    if (repeatWeeks > 0) load();
    else
      setBlocks((prev) =>
        [...prev, data.block].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
      );
    setTitle("");
    setStart("");
    setEnd("");
    setRepeatWeeks(0);
  }

  async function remove(b: Block) {
    if (b.seriesId) {
      setBlocks((prev) => prev.filter((x) => x.seriesId !== b.seriesId));
      await fetch(`/api/time-blocks/${b.id}?series=1`, { method: "DELETE" });
    } else {
      setBlocks((prev) => prev.filter((x) => x.id !== b.id));
      await fetch(`/api/time-blocks/${b.id}`, { method: "DELETE" });
    }
  }

  // Collapse a recurring series to a single row (its earliest upcoming occurrence).
  const displayed: Block[] = [];
  const seenSeries = new Set<string>();
  for (const b of blocks) {
    if (b.seriesId) {
      if (seenSeries.has(b.seriesId)) continue;
      seenSeries.add(b.seriesId);
    }
    displayed.push(b);
  }

  return (
    <Card className="mt-8">
      <CardHeader
        title="Personal & focus blocks"
        description="Protect time on your calendar - bookers can't schedule over these."
      />
      <CardBody className="space-y-4">
        {displayed.length > 0 ? (
          <ul className="space-y-2">
            {displayed.map((b) => {
              const Icon = KIND_ICON[b.kind] ?? User;
              const recurring = Boolean(b.seriesId);
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-4 py-2.5"
                >
                  <Icon size={16} className="text-[var(--color-accent)]" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {b.title}
                      {recurring ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--color-accent)]">
                          <Repeat size={10} /> Weekly
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {recurring
                        ? `${DateTime.fromISO(b.startsAt).toFormat("cccc")} · ${DateTime.fromISO(b.startsAt).toFormat("h:mm a")} – ${DateTime.fromISO(b.endsAt).toFormat("h:mm a")}`
                        : `${DateTime.fromISO(b.startsAt).toFormat("ccc, LLL d · h:mm a")} – ${DateTime.fromISO(b.endsAt).toFormat("h:mm a")}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(b)}
                    aria-label={recurring ? "Remove recurring block" : "Remove block"}
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
          <div className="flex items-center gap-2">
            <Label htmlFor="tb-repeat">Repeat weekly</Label>
            <Select
              id="tb-repeat"
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
              className="w-40"
            >
              <option value={0}>No - one-off</option>
              <option value={3}>for 4 weeks</option>
              <option value={7}>for 8 weeks</option>
              <option value={11}>for 12 weeks</option>
              <option value={25}>for 26 weeks</option>
            </Select>
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
