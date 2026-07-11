"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

/** Preset booking-page accent colours (hex). `null` = the default DayOtter theme. */
const BRAND_PRESETS = ["#5b4be6", "#0ea5e9", "#10b981", "#f59e0b", "#ef6a52", "#ec4899"];

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    timezone: string;
    handle: string;
    brandColor?: string | null;
    welcomeMessage?: string;
  };
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
  const [brandColor, setBrandColor] = useState<string | null>(initial.brandColor ?? null);
  const [welcomeMessage, setWelcomeMessage] = useState(initial.welcomeMessage ?? "");
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
      body: JSON.stringify({
        name,
        timezone,
        handle,
        brandColor,
        welcomeMessage: welcomeMessage.trim() || null,
      }),
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

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-1 text-sm font-medium">Booking page</p>
            <p className="mb-3 text-xs text-[var(--color-faint)]">
              Personalize the public page bookers see at /{handle || "your-handle"}.
            </p>

            <div className="mb-4">
              <Label htmlFor="p-welcome">Welcome message</Label>
              <Textarea
                id="p-welcome"
                rows={2}
                maxLength={280}
                value={welcomeMessage}
                onChange={(e) => {
                  setWelcomeMessage(e.target.value);
                  setSaved(false);
                }}
                placeholder="A short intro shown on your booking page."
              />
            </div>

            <div>
              <Label>Accent colour</Label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBrandColor(null);
                    setSaved(false);
                  }}
                  aria-pressed={brandColor === null}
                  className={
                    brandColor === null
                      ? "h-8 rounded-full border border-[var(--color-text)] px-3 text-xs font-medium"
                      : "h-8 rounded-full border border-[var(--color-border)] px-3 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]"
                  }
                >
                  Default
                </button>
                {BRAND_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    aria-pressed={brandColor?.toLowerCase() === c}
                    onClick={() => {
                      setBrandColor(c);
                      setSaved(false);
                    }}
                    style={{ backgroundColor: c }}
                    className={
                      brandColor?.toLowerCase() === c
                        ? "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[var(--color-surface)] ring-[var(--color-text)]"
                        : "h-8 w-8 rounded-full ring-1 ring-inset ring-black/10"
                    }
                  />
                ))}
                <label className="ml-1 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3 text-xs text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]">
                  Custom
                  <input
                    type="color"
                    value={brandColor ?? "#5b4be6"}
                    onChange={(e) => {
                      setBrandColor(e.target.value);
                      setSaved(false);
                    }}
                    className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>
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
