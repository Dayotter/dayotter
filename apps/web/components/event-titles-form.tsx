"use client";

import { TitleOptionsEditor } from "@/components/title-options-editor";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type TypeRow = { id: string; title: string; custom: boolean };

/** Account-wide default calendar title, used by every booking type set to "Default". */
export function EventTitlesForm({
  initial,
  host,
  types,
}: {
  initial: string;
  host: string;
  types: TypeRow[];
}) {
  const [template, setTemplate] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookingTitleTemplate: template.trim() || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader
          title="Default event title"
          description="How bookings are named in your calendar, unless a booking type sets its own."
        />
        <CardBody className="p-5">
          <form onSubmit={onSubmit} className="space-y-5">
            <TitleOptionsEditor
              value={template}
              onChange={(v) => {
                setTemplate(v);
                setSaved(false);
              }}
              fallback="Booking type title"
              sample={{ host, typeTitle: types[0]?.title || "Intro call", durationMinutes: 30 }}
            />
            <FormError>{error}</FormError>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              {saved ? (
                <span className="inline-flex items-center gap-1 text-sm text-[var(--color-success)]">
                  <Check size={15} /> Saved
                </span>
              ) : null}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Booking types" description="Default follows the title above." />
        {types.length === 0 ? (
          <p className="px-5 py-4 text-sm text-[var(--color-muted)]">No booking types yet.</p>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {types.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <span className="min-w-0 truncate text-sm font-medium">{t.title}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-[var(--color-muted)]">
                    {t.custom ? "Custom" : "Default"}
                  </span>
                  <Link
                    href={`/event-types/${t.id}/edit`}
                    aria-label={`Edit ${t.title}`}
                    className="text-xs font-medium text-[var(--color-accent)] hover:underline"
                  >
                    Edit
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
