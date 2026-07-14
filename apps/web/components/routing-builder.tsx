"use client";

import { CopyLinkButton } from "@/components/copy-link-button";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import type { RoutingField, RoutingRoute } from "@dayotter/db";
import { ArrowRight, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type EventTypeOpt = { id: string; title: string; slug: string };

const rid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `${Date.now()}${Math.floor(Math.random() * 1e6)}`;

export function RoutingBuilder({
  form,
  eventTypes,
  shareUrl,
  sharePath,
  responseCount,
}: {
  form: {
    id: string;
    title: string;
    description: string | null;
    isActive: boolean;
    fields: RoutingField[];
    routes: RoutingRoute[];
    fallbackEventTypeId: string | null;
  };
  eventTypes: EventTypeOpt[];
  shareUrl: string;
  sharePath: string;
  responseCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(form.title);
  const [description, setDescription] = useState(form.description ?? "");
  const [active, setActive] = useState(form.isActive);
  const [fields, setFields] = useState<RoutingField[]>(form.fields);
  const [routes, setRoutes] = useState<RoutingRoute[]>(form.routes);
  const [fallback, setFallback] = useState(form.fallbackEventTypeId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectFields = fields.filter((f) => f.type === "select");

  function patchField(id: string, patch: Partial<RoutingField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  function addField() {
    setFields((prev) => [
      ...prev,
      { id: rid(), label: "", type: "select", options: ["", ""], required: true },
    ]);
  }
  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    setRoutes((prev) => prev.filter((r) => r.fieldId !== id));
  }
  function setOption(fieldId: string, i: number, value: string) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId
          ? { ...f, options: (f.options ?? []).map((o, j) => (j === i ? value : o)) }
          : f,
      ),
    );
  }
  function addOption(fieldId: string) {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, options: [...(f.options ?? []), ""] } : f)),
    );
  }
  function removeOption(fieldId: string, i: number) {
    setFields((prev) =>
      prev.map((f) =>
        f.id === fieldId ? { ...f, options: (f.options ?? []).filter((_, j) => j !== i) } : f,
      ),
    );
  }

  function patchRoute(id: string, patch: Partial<RoutingRoute>) {
    setRoutes((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function addRoute() {
    const f = selectFields[0];
    setRoutes((prev) => [
      ...prev,
      { id: rid(), fieldId: f?.id ?? "", equals: f?.options?.[0] ?? "", eventTypeId: "" },
    ]);
  }

  async function save() {
    setError(null);
    // Clean options before validating.
    const cleanFields = fields.map((f) => ({
      ...f,
      label: f.label.trim(),
      options:
        f.type === "select" ? (f.options ?? []).map((o) => o.trim()).filter(Boolean) : undefined,
    }));
    if (cleanFields.some((f) => !f.label)) return setError("Give every question a label.");
    if (cleanFields.some((f) => f.type === "select" && (f.options?.length ?? 0) < 2))
      return setError("Each choice question needs at least two options.");
    const validRoutes = routes.filter((r) => r.fieldId && r.equals && r.eventTypeId);

    setSaving(true);
    const res = await fetch(`/api/routing/${form.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        isActive: active,
        fields: cleanFields,
        routes: validRoutes,
        fallbackEventTypeId: fallback || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    toast({ title: "Routing form saved.", variant: "success" });
    router.refresh();
  }

  const noEventTypes = eventTypes.length === 0;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Share + status */}
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3">
        <span className="text-sm text-[var(--color-muted)]">Share:</span>
        <code className="min-w-0 flex-1 truncate rounded-sm bg-[var(--color-bg)] px-2 py-1 text-xs">
          {shareUrl}
        </code>
        <CopyLinkButton path={sharePath} />
        <span className="text-xs text-[var(--color-faint)]">{responseCount} responses</span>
      </div>

      {noEventTypes ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-amber)]/40 bg-[var(--color-amber)]/[0.08] px-4 py-3 text-sm text-[var(--color-amber)]">
          Create at least one booking type first - routes send people to a booking page.
        </p>
      ) : null}

      {/* Basics */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="rf-title">Form name</Label>
          <Input id="rf-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="rf-desc">Intro (optional)</Label>
          <Input
            id="rf-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Answer a couple of questions and we'll get you to the right person."
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Form is live
        </label>
      </div>

      {/* Questions */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Questions</h2>
        {fields.map((f) => (
          <div
            key={f.id}
            className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4"
          >
            <div className="flex items-center gap-2">
              <Input
                value={f.label}
                onChange={(e) => patchField(f.id, { label: e.target.value })}
                placeholder="e.g. What do you need help with?"
              />
              <div className="w-36 shrink-0">
                <Select
                  value={f.type}
                  onChange={(e) =>
                    patchField(f.id, {
                      type: e.target.value as RoutingField["type"],
                      options: e.target.value === "select" ? (f.options ?? ["", ""]) : undefined,
                    })
                  }
                >
                  <option value="select">Choice</option>
                  <option value="text">Short text</option>
                  <option value="email">Email</option>
                </Select>
              </div>
              <button
                type="button"
                onClick={() => removeField(f.id)}
                aria-label="Remove question"
                className="rounded-md p-2 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
              >
                <X size={16} />
              </button>
            </div>
            {f.type === "select" ? (
              <div className="space-y-1.5 pl-1">
                {(f.options ?? []).map((o, i) => (
                  <div key={`${f.id}-${i}`} className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-faint)]">•</span>
                    <Input
                      value={o}
                      onChange={(e) => setOption(f.id, i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="h-9"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(f.id, i)}
                      disabled={(f.options?.length ?? 0) <= 2}
                      aria-label="Remove option"
                      className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)] disabled:opacity-30"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addOption(f.id)}
                  className="ml-4 text-xs text-[var(--color-accent)] hover:underline"
                >
                  + Add option
                </button>
              </div>
            ) : null}
          </div>
        ))}
        <button
          type="button"
          onClick={addField}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
        >
          <Plus size={15} /> Add question
        </button>
      </section>

      {/* Routing rules */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Where answers go</h2>
        <p className="-mt-1 text-xs text-[var(--color-faint)]">
          Checked top to bottom - the first rule that matches wins.
        </p>
        {routes.map((r) => {
          const field = selectFields.find((f) => f.id === r.fieldId);
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3 text-sm"
            >
              <span className="text-[var(--color-muted)]">If</span>
              <div className="min-w-[130px] flex-1">
                <Select
                  value={r.fieldId}
                  onChange={(e) => {
                    const nf = selectFields.find((f) => f.id === e.target.value);
                    patchRoute(r.id, { fieldId: e.target.value, equals: nf?.options?.[0] ?? "" });
                  }}
                >
                  <option value="" disabled>
                    Question…
                  </option>
                  {selectFields.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label || "Untitled"}
                    </option>
                  ))}
                </Select>
              </div>
              <span className="text-[var(--color-muted)]">is</span>
              <div className="min-w-[120px] flex-1">
                <Select
                  value={r.equals}
                  onChange={(e) => patchRoute(r.id, { equals: e.target.value })}
                >
                  <option value="" disabled>
                    Answer…
                  </option>
                  {(field?.options ?? []).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </div>
              <ArrowRight size={15} className="text-[var(--color-faint)]" />
              <div className="min-w-[150px] flex-1">
                <Select
                  value={r.eventTypeId}
                  onChange={(e) => patchRoute(r.id, { eventTypeId: e.target.value })}
                >
                  <option value="" disabled>
                    Booking type…
                  </option>
                  {eventTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.title}
                    </option>
                  ))}
                </Select>
              </div>
              <button
                type="button"
                onClick={() => setRoutes((prev) => prev.filter((x) => x.id !== r.id))}
                aria-label="Remove rule"
                className="rounded-md p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          onClick={addRoute}
          disabled={selectFields.length === 0}
          className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline disabled:opacity-40"
        >
          <Plus size={15} /> Add rule
        </button>

        <div className="pt-2">
          <Label htmlFor="rf-fallback">Otherwise, send everyone to</Label>
          <div className="max-w-sm">
            <Select id="rf-fallback" value={fallback} onChange={(e) => setFallback(e.target.value)}>
              <option value="">No default - show a thank-you</option>
              {eventTypes.map((et) => (
                <option key={et.id} value={et.id}>
                  {et.title}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </section>

      <FormError>{error}</FormError>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save form"}
        </Button>
      </div>
    </div>
  );
}
