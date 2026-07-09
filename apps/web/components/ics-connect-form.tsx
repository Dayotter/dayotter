"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Subscribe to an external ICS / webcal feed (read-only). Verifies the feed
 * server-side and shows inline feedback, mirroring the Apple connect flow.
 */
export function IcsConnectForm({ name, color }: { name: string; color: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/calendars/ics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, name: label || undefined }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not connect");
      return;
    }
    setOpen(false);
    setUrl("");
    setLabel("");
    router.refresh();
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-3 text-sm">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-sm text-xs font-bold text-white"
            style={{ background: color }}
          >
            {name.charAt(0)}
          </span>
          {name}
        </span>
        <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus size={15} /> Add feed
        </Button>
      </div>

      {open ? (
        <form
          onSubmit={connect}
          className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4"
        >
          <div>
            <Label htmlFor="ics-url">Feed URL</Label>
            <Input
              id="ics-url"
              type="url"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…/basic.ics or webcal://…"
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              A read-only iCal feed address (Google's "secret address in iCal format", an Outlook
              published URL, etc.). Its busy times block your availability; it's never written to.
            </p>
          </div>
          <div>
            <Label htmlFor="ics-name">Name (optional)</Label>
            <Input
              id="ics-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Work calendar"
            />
          </div>
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Adding…" : "Add feed"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
