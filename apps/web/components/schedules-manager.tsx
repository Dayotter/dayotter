"use client";

import { AvailabilityEditor } from "@/components/availability-editor";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";

interface ScheduleSummary {
  id: string;
  name: string;
  isDefault: boolean;
  ruleCount: number;
}

interface Range {
  start: string;
  end: string;
}
interface Override {
  date: string;
  start: string | null;
  end: string | null;
}
interface ScheduleDetail {
  timezone: string;
  days: Range[][];
  overrides: Override[];
}

export function SchedulesManager({
  initialSchedules,
  initialSelected,
  initialDetail,
}: {
  initialSchedules: ScheduleSummary[];
  initialSelected: string;
  initialDetail: ScheduleDetail;
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [selectedId, setSelectedId] = useState(initialSelected);
  const [detail, setDetail] = useState<ScheduleDetail | null>(initialDetail);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Themed name prompt (create + rename), replacing window.prompt.
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptMode, setPromptMode] = useState<"create" | "rename">("create");
  const [promptName, setPromptName] = useState("");
  const [promptId, setPromptId] = useState<string | null>(null);

  // Themed delete confirm, replacing window.confirm / window.alert.
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = schedules.find((s) => s.id === selectedId);

  async function loadDetail(id: string) {
    setLoading(true);
    setDetail(null);
    const res = await fetch(`/api/schedules/${id}`);
    setLoading(false);
    if (res.ok) {
      const d = await res.json();
      setDetail({ timezone: d.timezone, days: d.days, overrides: d.overrides });
    }
  }

  function select(id: string) {
    if (id === selectedId) return;
    setSelectedId(id);
    loadDetail(id);
  }

  async function refreshList() {
    const res = await fetch("/api/schedules");
    if (res.ok) setSchedules((await res.json()).schedules);
  }

  function openCreate() {
    setPromptMode("create");
    setPromptName("");
    setPromptId(null);
    setPromptOpen(true);
  }

  function openRename(id: string, current: string) {
    setPromptMode("rename");
    setPromptName(current);
    setPromptId(id);
    setPromptOpen(true);
  }

  async function submitPrompt(e: React.FormEvent) {
    e.preventDefault();
    const name = promptName.trim();
    if (!name) return;
    setBusy(true);
    if (promptMode === "create") {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setBusy(false);
      setPromptOpen(false);
      if (res.ok) {
        const { id } = await res.json();
        await refreshList();
        setSelectedId(id);
        await loadDetail(id);
      }
    } else if (promptId) {
      await fetch(`/api/schedules/${promptId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setBusy(false);
      setPromptOpen(false);
      await refreshList();
    }
  }

  async function makeDefault(id: string) {
    setBusy(true);
    await fetch(`/api/schedules/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    setBusy(false);
    await refreshList();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/schedules/${id}`, { method: "DELETE" });
    setDeleting(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Could not delete." }));
      // Close the dialog and surface the reason inline (e.g. can't delete default).
      setPendingDelete(null);
      setDeleteError(error ?? "Could not delete that schedule.");
      return;
    }
    setPendingDelete(null);
    await refreshList();
    if (id === selectedId) {
      const fallback = schedules.find((s) => s.isDefault) ?? schedules.find((s) => s.id !== id);
      if (fallback) select(fallback.id);
    }
  }

  return (
    <>
      {deleteError ? (
        <div className="mb-4">
          <FormError>{deleteError}</FormError>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-2">
          <ul className="space-y-1">
            {schedules.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => select(s.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    s.id === selectedId
                      ? "border-[var(--color-accent)] bg-[var(--color-surface-2)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  {s.isDefault ? (
                    <span
                      title="Default schedule"
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)]"
                    >
                      <Star size={11} fill="currentColor" /> Default
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={openCreate}
            disabled={busy}
          >
            <Plus size={14} /> New schedule
          </Button>
        </aside>

        <div>
          {selected ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-lg font-semibold">{selected.name}</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openRename(selected.id, selected.name)}
              >
                Rename
              </Button>
              {!selected.isDefault ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => makeDefault(selected.id)}>
                    <Star size={14} /> Make default
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[var(--color-danger)]"
                    onClick={() => {
                      setDeleteError(null);
                      setPendingDelete({ id: selected.id, name: selected.name });
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </Button>
                </>
              ) : null}
            </div>
          ) : null}

          {loading || !detail ? (
            <div className="flex items-center gap-2 py-16 text-sm text-[var(--color-muted)]">
              <Loader2 size={15} className="animate-spin" /> Loading…
            </div>
          ) : (
            <AvailabilityEditor key={selectedId} scheduleId={selectedId} initial={detail} />
          )}
        </div>
      </div>

      <Dialog
        open={promptOpen}
        onClose={() => setPromptOpen(false)}
        title={promptMode === "create" ? "New schedule" : "Rename schedule"}
        description={
          promptMode === "create"
            ? "Give this availability schedule a name, e.g. Consulting hours."
            : undefined
        }
      >
        <form onSubmit={submitPrompt} className="space-y-4">
          <Input
            autoFocus
            value={promptName}
            onChange={(e) => setPromptName(e.target.value)}
            placeholder="Consulting hours"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setPromptOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy || !promptName.trim()}>
              {busy ? "Saving…" : promptMode === "create" ? "Create" : "Save"}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete schedule?"}
        description="Event types using this schedule will fall back to your default. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  );
}
