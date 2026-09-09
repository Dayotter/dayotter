"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { type PollMessageTemplate, validatePollTemplate } from "@/lib/polls/message-templates";
import { Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Manage the host's named, reusable meeting-details templates for polls. Rendered
 * on Settings → Preferences. Each template can be marked default - the one
 * pre-filled when finalizing a poll - so recurring details (a Zoom link, ...)
 * are entered once and reused across every poll.
 */
export function PollMessageTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<PollMessageTemplate[] | null>(null);
  const [editing, setEditing] = useState<PollMessageTemplate | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/poll-templates", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(data.templates);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function startAdd() {
    setEditing(null);
    setName("");
    setBody("");
    setIsDefault(false);
    setError(null);
    setAdding(true);
  }

  function startEdit(t: PollMessageTemplate) {
    setEditing(t);
    setName(t.name);
    setBody(t.body);
    setIsDefault(t.isDefault);
    setError(null);
    setAdding(true);
  }

  async function save() {
    const validation = validatePollTemplate({ name, body });
    if (validation) {
      setError(validation);
      return;
    }
    setBusy(true);
    setError(null);
    const url = editing ? `/api/poll-templates/${editing.id}` : "/api/poll-templates";
    const res = await fetch(url, {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), body: body.trim(), isDefault }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Couldn't save template");
      return;
    }
    toast({
      title: editing ? "Template updated" : "Template saved",
      variant: "success",
    });
    setAdding(false);
    setEditing(null);
    await load();
  }

  async function remove(t: PollMessageTemplate) {
    if (!window.confirm(`Delete "${t.name}"?`)) return;
    const res = await fetch(`/api/poll-templates/${t.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast({
        title: typeof data.error === "string" ? data.error : "Couldn't delete template",
        variant: "error",
      });
      return;
    }
    toast({ title: "Template deleted", variant: "success" });
    await load();
  }

  return (
    <Card className="max-w-2xl">
      <CardBody className="p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Poll message templates</h2>
            <p className="mt-0.5 text-xs text-[var(--color-muted)]">
              Saved meeting-details messages you can pick from when finalizing a poll - set your
              recurring Zoom link once, use it everywhere.
            </p>
          </div>
          {!adding && templates ? (
            <Button variant="outline" onClick={startAdd}>
              <Plus size={15} /> New template
            </Button>
          ) : null}
        </div>

        {templates === null ? (
          <p className="mt-4 text-sm text-[var(--color-faint)]">Loading…</p>
        ) : templates.length === 0 && !adding ? (
          <p className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] p-4 text-sm text-[var(--color-muted)]">
            No templates yet. Create one and it'll be offered when you finalize a poll - the first
            one becomes your default.
          </p>
        ) : null}

        {adding ? (
          <div className="mt-4 space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
            <div>
              <Label htmlFor="poll-template-name">Name</Label>
              <Input
                id="poll-template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Zoom 1:1"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="poll-template-body">Message</Label>
              <p className="-mt-1 mb-2 text-xs text-[var(--color-faint)]">
                Use {"{details}"} as a placeholder for an auto-generated meeting link (Google Meet /
                Teams).
              </p>
              <Textarea
                id="poll-template-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder={"We'll meet over video.\n\nJoin here: {details}"}
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Make this my default
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Pre-filled automatically when you finalize a poll.
                </span>
              </span>
            </label>
            {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAdding(false);
                  setEditing(null);
                  setError(null);
                }}
              >
                <X size={15} /> Cancel
              </Button>
              <Button onClick={save} disabled={busy}>
                {busy ? "Saving…" : editing ? "Save changes" : "Save template"}
              </Button>
            </div>
          </div>
        ) : null}

        {templates && templates.length > 0 ? (
          <ul className="mt-4 divide-y divide-[var(--color-border)]">
            {templates.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {t.isDefault ? (
                      <Star size={13} className="shrink-0 text-[var(--color-accent)]" />
                    ) : null}
                    <span className="truncate">{t.name}</span>
                    {t.isDefault ? (
                      <span className="text-xs font-normal text-[var(--color-accent)]">
                        default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 whitespace-pre-line text-xs text-[var(--color-muted)]">
                    {t.body}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!t.isDefault ? (
                    <button
                      type="button"
                      onClick={() =>
                        fetch(`/api/poll-templates/${t.id}`, {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ isDefault: true }),
                        }).then(load)
                      }
                      aria-label={`Make ${t.name} the default`}
                      className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-accent)]"
                    >
                      <Star size={15} />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => startEdit(t)}
                    aria-label={`Edit ${t.name}`}
                    className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t)}
                    aria-label={`Delete ${t.name}`}
                    className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {!adding && templates && templates.length > 0 ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-faint)]">
            <Check size={13} /> The default template is pre-filled when you finalize a poll - you
            can still change it there or pick another.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}
