"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

function timezones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf(
      "timeZone",
    );
  } catch {
    return ["UTC"];
  }
}

export function ProfileForm({
  initial,
}: {
  initial: { name: string; timezone: string; handle: string };
}) {
  const router = useRouter();
  // Ensure the stored timezone is always selectable — some runtimes omit "UTC"
  // and a few aliases from Intl.supportedValuesOf.
  const zones = useMemo(() => {
    const list = timezones();
    return list.includes(initial.timezone) ? list : [initial.timezone, ...list];
  }, [initial.timezone]);
  const [name, setName] = useState(initial.name);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [handle, setHandle] = useState(initial.handle);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, timezone, handle }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <CardBody className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
            />
          </div>

          <div>
            <Label htmlFor="p-handle">Booking handle</Label>
            <Input
              id="p-handle"
              required
              value={handle}
              onChange={(e) => {
                setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSaved(false);
              }}
              placeholder="ada"
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Your public page will be at /{handle || "your-handle"}
            </p>
          </div>

          <div>
            <Label htmlFor="p-tz">Timezone</Label>
            <Select id="p-tz" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </Select>
          </div>

          <FormError>{error}</FormError>

          <div className="flex items-center gap-3 pt-1">
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
  );
}
