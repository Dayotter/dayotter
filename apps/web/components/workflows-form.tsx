"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { Mail, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type Trigger = "before_event" | "after_event";

interface Workflow {
  id: string;
  name: string;
  trigger: Trigger;
  offsetMinutes: number;
  action: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  eventTypeIds: string[];
}

interface EventTypeOption {
  id: string;
  title: string;
}

/** Placeholders a host can drop into the subject/body. Mirrors WORKFLOW_VARIABLES. */
const VARIABLES = [
  "attendee_name",
  "host_name",
  "event_title",
  "event_date",
  "location",
  "meeting_url",
  "manage_url",
];

const OFFSET_PRESETS = [
  { value: 15, label: "15 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
];

function humanOffset(mins: number): string {
  if (mins % 1440 === 0) return `${mins / 1440} day${mins / 1440 > 1 ? "s" : ""}`;
  if (mins % 60 === 0) return `${mins / 60} hour${mins / 60 > 1 ? "s" : ""}`;
  return `${mins} min`;
}

function describe(w: Workflow): string {
  const scope =
    w.eventTypeIds.length === 0
      ? "every event type"
      : `${w.eventTypeIds.length} event type${w.eventTypeIds.length > 1 ? "s" : ""}`;
  return w.trigger === "after_event"
    ? `Email attendees ${humanOffset(w.offsetMinutes)} after the meeting ends · ${scope}`
    : `Email attendees ${humanOffset(w.offsetMinutes)} before the meeting starts · ${scope}`;
}

const EMPTY = {
  name: "",
  trigger: "before_event" as Trigger,
  offsetMinutes: 60,
  subjectTemplate: "Reminder: {{event_title}}",
  bodyTemplate:
    "Hi {{attendee_name}},\n\nThis is a reminder about {{event_title}} on {{event_date}}.\n\nSee you then!",
  eventTypeIds: [] as string[],
};

/** Workflow Engine UI: automated attendee emails around each booking. */
export function WorkflowsForm() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [eventTypes, setEventTypes] = useState<EventTypeOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((d) => setWorkflows(d.workflows ?? []))
      .catch(() => {});
    fetch("/api/event-types")
      .then((r) => r.json())
      .then((d) =>
        setEventTypes(
          (d.eventTypes ?? []).map((e: EventTypeOption) => ({ id: e.id, title: e.title })),
        ),
      )
      .catch(() => {});
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY });
    setError(null);
  }

  function startEdit(w: Workflow) {
    setEditingId(w.id);
    setForm({
      name: w.name,
      trigger: w.trigger,
      offsetMinutes: w.offsetMinutes,
      subjectTemplate: w.subjectTemplate,
      bodyTemplate: w.bodyTemplate,
      eventTypeIds: w.eventTypeIds,
    });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const editing = editingId != null;
    const res = await fetch(editing ? `/api/workflows/${editingId}` : "/api/workflows", {
      method: editing ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, isActive: true }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Couldn't save that workflow");
      return;
    }
    track(editing ? "Workflow Updated" : "Workflow Created", { trigger: form.trigger });
    // Refetch to keep the list authoritative (edit returns {ok}, not the row).
    const list = await fetch("/api/workflows").then((r) => r.json());
    setWorkflows(list.workflows ?? []);
    resetForm();
  }

  async function toggle(w: Workflow) {
    const next = !w.isActive;
    setWorkflows((prev) => prev.map((x) => (x.id === w.id ? { ...x, isActive: next } : x)));
    const res = await fetch(`/api/workflows/${w.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...w, isActive: next }),
    });
    if (!res.ok)
      setWorkflows((prev) => prev.map((x) => (x.id === w.id ? { ...x, isActive: !next } : x)));
  }

  async function remove(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    if (editingId === id) resetForm();
    await fetch(`/api/workflows/${id}`, { method: "DELETE" });
  }

  function toggleEventType(id: string) {
    setForm((f) => ({
      ...f,
      eventTypeIds: f.eventTypeIds.includes(id)
        ? f.eventTypeIds.filter((x) => x !== id)
        : [...f.eventTypeIds, id],
    }));
  }

  return (
    <Card className="max-w-xl">
      <CardHeader
        title="Workflows"
        description="Automated emails to attendees around each booking — a reminder before, a thank-you or follow-up after. Applies to every event type unless you scope it."
      />
      <CardBody className="space-y-5">
        {workflows.length > 0 ? (
          <ul className="space-y-2">
            {workflows.map((w) => (
              <li
                key={w.id}
                className="flex items-start gap-3 rounded-md border border-[var(--color-border)] px-4 py-3"
              >
                <Mail
                  size={16}
                  className={
                    w.isActive
                      ? "mt-0.5 text-[var(--color-accent)]"
                      : "mt-0.5 text-[var(--color-faint)]"
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{w.name}</p>
                  <p className="text-xs text-[var(--color-muted)]">{describe(w)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(w)}
                  className="text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
                >
                  Edit
                </button>
                <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                  <input
                    type="checkbox"
                    checked={w.isActive}
                    onChange={() => toggle(w)}
                    className="accent-[var(--color-accent)]"
                  />
                  On
                </label>
                <button
                  type="button"
                  onClick={() => remove(w.id)}
                  aria-label="Remove workflow"
                  className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No workflows yet. Create one below — e.g. a friendly reminder one hour before every
            meeting.
          </p>
        )}

        <form onSubmit={save} className="space-y-3 border-t border-[var(--color-border)] pt-4">
          <p className="text-sm font-medium">{editingId ? "Edit workflow" : "New workflow"}</p>
          <div>
            <Label htmlFor="wf-name">Name</Label>
            <Input
              id="wf-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Pre-meeting reminder"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="wf-trigger">Send</Label>
              <Select
                id="wf-trigger"
                value={form.trigger}
                onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value as Trigger }))}
              >
                <option value="before_event">Before the meeting</option>
                <option value="after_event">After the meeting</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="wf-offset">Timing</Label>
              <Select
                id="wf-offset"
                value={form.offsetMinutes}
                onChange={(e) => setForm((f) => ({ ...f, offsetMinutes: Number(e.target.value) }))}
              >
                {OFFSET_PRESETS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} {form.trigger === "after_event" ? "after" : "before"}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="wf-subject">Subject</Label>
            <Input
              id="wf-subject"
              value={form.subjectTemplate}
              onChange={(e) => setForm((f) => ({ ...f, subjectTemplate: e.target.value }))}
              placeholder="Reminder: {{event_title}}"
            />
          </div>
          <div>
            <Label htmlFor="wf-body">Message</Label>
            <Textarea
              id="wf-body"
              rows={5}
              value={form.bodyTemplate}
              onChange={(e) => setForm((f) => ({ ...f, bodyTemplate: e.target.value }))}
              required
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Variables:{" "}
              {VARIABLES.map((v, i) => (
                <span key={v}>
                  {i > 0 ? " " : ""}
                  <code className="rounded bg-[var(--color-surface-2)] px-1">{`{{${v}}}`}</code>
                </span>
              ))}
            </p>
          </div>
          {eventTypes.length > 0 ? (
            <div>
              <Label>Applies to</Label>
              <p className="mb-1.5 text-xs text-[var(--color-faint)]">
                Leave all unchecked to apply to every event type.
              </p>
              <div className="flex flex-wrap gap-2">
                {eventTypes.map((et) => {
                  const on = form.eventTypeIds.includes(et.id);
                  return (
                    <button
                      key={et.id}
                      type="button"
                      onClick={() => toggleEventType(et.id)}
                      className={
                        on
                          ? "rounded-full border border-[var(--color-accent)] bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-text)]"
                          : "rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                      }
                    >
                      {et.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <FormError>{error}</FormError>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={saving || !form.name.trim() || !form.bodyTemplate.trim()}
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add workflow"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
