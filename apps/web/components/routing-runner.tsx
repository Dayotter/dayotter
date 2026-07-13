"use client";

import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { RoutingField } from "@dayotter/db";
import { useRouter } from "next/navigation";
import { useState } from "react";

/** Public routing form: collect answers, then jump to the matched booking page. */
export function RoutingRunner({ token, fields }: { token: string; fields: RoutingField[] }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(id: string, v: string) {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = fields.find((f) => f.required && !answers[f.id]?.trim());
    if (missing) return setError(`Please answer "${missing.label}".`);

    setSubmitting(true);
    const res = await fetch(`/api/forms/${token}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.url !== "string") {
      setSubmitting(false);
      setError(typeof data.error === "string" ? data.error : "Something went wrong");
      return;
    }
    router.push(data.url as `/${string}`);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      {fields.map((f) => (
        <div key={f.id}>
          <Label htmlFor={`f-${f.id}`}>
            {f.label}
            {f.required ? <span className="text-[var(--color-danger)]"> *</span> : null}
          </Label>
          {f.type === "select" ? (
            <Select
              id={`f-${f.id}`}
              value={answers[f.id] ?? ""}
              onChange={(e) => set(f.id, e.target.value)}
            >
              <option value="" disabled>
                Choose…
              </option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={`f-${f.id}`}
              type={f.type === "email" ? "email" : "text"}
              value={answers[f.id] ?? ""}
              onChange={(e) => set(f.id, e.target.value)}
            />
          )}
        </div>
      ))}
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? "Finding your time…" : "Continue"}
      </Button>
    </form>
  );
}
