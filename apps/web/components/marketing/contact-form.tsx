"use client";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        message: form.get("message"),
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError("Couldn't send that. Please email us directly.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="font-medium">Thanks — we got your message.</p>
        <p className="mt-1 text-sm text-[var(--color-muted)]">We'll get back to you shortly.</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
    >
      <div>
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Ada Lovelace" />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@company.com" />
      </div>
      <div>
        <Label htmlFor="message">Message</Label>
        <Textarea id="message" name="message" required rows={5} placeholder="How can we help?" />
      </div>
      {error ? <p className="text-sm text-[var(--color-danger)]">{error}</p> : null}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
