"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { ArrowRightLeft, Trash2, TreePalm } from "lucide-react";
import { DateTime } from "luxon";
import { useEffect, useState } from "react";

interface Teammate {
  id: string;
  name: string | null;
  handle: string | null;
}
interface Period {
  id: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  delegate: Teammate | null;
}

function fmt(date: string): string {
  return DateTime.fromISO(date).toFormat("LLL d, yyyy");
}

/** First-class out-of-office: block your own availability for a date range and,
 *  optionally, redirect new bookings to a teammate while you're away. */
export function OutOfOffice() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [teammates, setTeammates] = useState<Teammate[]>([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [delegateUserId, setDelegateUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    fetch("/api/out-of-office")
      .then((r) => r.json())
      .then((d: { periods?: Period[]; teammates?: Teammate[] }) => {
        setPeriods(d.periods ?? []);
        setTeammates(d.teammates ?? []);
      })
      .catch(() => {});
  }
  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!startDate || !endDate || endDate < startDate) {
      setError("Pick a start date and an end date on or after it.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/out-of-office", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        startDate,
        endDate,
        reason: reason.trim() || undefined,
        delegateUserId: delegateUserId || null,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't save that period");
      return;
    }
    track("Out Of Office Created", { hasDelegate: Boolean(delegateUserId) });
    setStartDate("");
    setEndDate("");
    setReason("");
    setDelegateUserId("");
    load();
  }

  async function remove(id: string) {
    setPeriods((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/out-of-office/${id}`, { method: "DELETE" });
  }

  const delegateName = (t: Teammate) => t.name ?? (t.handle ? `@${t.handle}` : "Teammate");

  return (
    <Card className="mt-8">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <TreePalm size={16} /> Out of office
          </span>
        }
        description="Mark yourself away for a date range - bookers can't schedule then. Optionally send them to a teammate instead."
      />
      <CardBody className="space-y-4">
        {periods.length > 0 ? (
          <ul className="space-y-2">
            {periods.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-4 py-2.5"
              >
                <TreePalm size={16} className="shrink-0 text-[var(--color-accent)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {fmt(p.startDate)}
                    {p.endDate !== p.startDate ? ` – ${fmt(p.endDate)}` : ""}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--color-muted)]">
                    {p.reason ? <span>{p.reason}</span> : null}
                    {p.delegate ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-accent)]">
                        <ArrowRightLeft size={11} /> {delegateName(p.delegate)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label="Remove out-of-office period"
                  className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            You're not marked away for any dates. Add a period below before your next break.
          </p>
        )}

        <form onSubmit={add} className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ooo-start">From</Label>
              <Input
                id="ooo-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="ooo-end">To</Label>
              <Input
                id="ooo-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="ooo-reason">Reason (optional)</Label>
            <Input
              id="ooo-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Annual leave"
              maxLength={200}
            />
          </div>
          <div>
            <Label htmlFor="ooo-delegate">Redirect bookings to (optional)</Label>
            <Select
              id="ooo-delegate"
              value={delegateUserId}
              onChange={(e) => setDelegateUserId(e.target.value)}
            >
              <option value="">No redirect</option>
              {teammates.map((t) => (
                <option key={t.id} value={t.id}>
                  {delegateName(t)}
                </option>
              ))}
            </Select>
            {teammates.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                Join a team to redirect bookings to a teammate while you're away.
              </p>
            ) : null}
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Add period"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
