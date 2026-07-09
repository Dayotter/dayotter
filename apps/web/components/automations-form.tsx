"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { Trash2, Zap } from "lucide-react";
import { useEffect, useState } from "react";

type Action = "prep_block" | "buffer_after" | "followup";
interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  matchTitle: string | null;
  action: string;
  offsetMinutes: number;
  blockTitle: string | null;
}

function describe(r: Rule): string {
  const when = r.matchTitle
    ? `a booking's title contains “${r.matchTitle}”`
    : "any booking is made";
  const what =
    r.action === "buffer_after"
      ? `add a ${r.offsetMinutes}-min buffer after`
      : r.action === "followup"
        ? `send a follow-up email ${r.offsetMinutes} min after`
        : `add a ${r.offsetMinutes}-min prep block before`;
  return `When ${when}, ${what} it.`;
}

/** Automation Engine UI: rules that fire when a booking is created. */
export function AutomationsForm() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [matchTitle, setMatchTitle] = useState("");
  const [action, setAction] = useState<Action>("prep_block");
  const [offset, setOffset] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/automations")
      .then((r) => r.json())
      .then((d) => setRules(d.rules ?? []))
      .catch(() => {});
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await fetch("/api/automations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        matchTitle: matchTitle.trim() || null,
        action,
        offsetMinutes: offset,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't create that rule");
      return;
    }
    track("Automation Rule Created", { action });
    setRules((prev) => [...prev, data.rule]);
    setName("");
    setMatchTitle("");
  }

  async function toggle(r: Rule) {
    const next = !r.enabled;
    setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: next } : x)));
    const res = await fetch(`/api/automations/${r.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    if (!res.ok)
      setRules((prev) => prev.map((x) => (x.id === r.id ? { ...x, enabled: !next } : x)));
  }

  async function remove(id: string) {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
  }

  return (
    <Card className="max-w-xl">
      <CardHeader
        title="Automations"
        description="Rules that run automatically when a booking is made — like reserving prep time before interviews."
      />
      <CardBody className="space-y-5">
        {rules.length > 0 ? (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex items-start gap-3 rounded-md border border-[var(--color-border)] px-4 py-3"
              >
                <Zap
                  size={16}
                  className={
                    r.enabled
                      ? "mt-0.5 text-[var(--color-accent)]"
                      : "mt-0.5 text-[var(--color-faint)]"
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{describe(r)}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={() => toggle(r)}
                    className="accent-[var(--color-accent)]"
                  />
                  On
                </label>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  aria-label="Remove rule"
                  className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No rules yet. Create one below — e.g. protect 15 minutes of prep before every interview.
          </p>
        )}

        <form onSubmit={add} className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <div>
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Interview prep"
              required
            />
          </div>
          <div>
            <Label htmlFor="rule-match">
              When a booking title contains (blank = every booking)
            </Label>
            <Input
              id="rule-match"
              value={matchTitle}
              onChange={(e) => setMatchTitle(e.target.value)}
              placeholder="Interview"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="rule-action">Then</Label>
              <Select
                id="rule-action"
                value={action}
                onChange={(e) => setAction(e.target.value as Action)}
              >
                <option value="prep_block">Add a prep block before</option>
                <option value="buffer_after">Add a buffer after</option>
                <option value="followup">Send a follow-up email after</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-offset">Minutes</Label>
              <Input
                id="rule-offset"
                type="number"
                min={5}
                max={240}
                value={offset}
                onChange={(e) => setOffset(Number(e.target.value) || 15)}
              />
            </div>
          </div>
          <FormError>{error}</FormError>
          <Button type="submit" size="sm" disabled={saving || !name.trim()}>
            {saving ? "Adding…" : "Add rule"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
