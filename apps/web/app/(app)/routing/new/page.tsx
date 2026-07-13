"use client";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewRoutingFormPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Give your form a name.");
    setSubmitting(true);
    const res = await fetch("/api/routing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not create form");
      return;
    }
    const data = await res.json();
    router.push(data.url as `/${string}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Routing form"
        title="New routing form"
        description="Ask a couple of questions, then send each visitor to the right booking page automatically."
      />
      <form onSubmit={submit} className="max-w-md space-y-4">
        <div>
          <Label htmlFor="rf-name">Form name</Label>
          <Input
            id="rf-name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Talk to sales"
            autoFocus
          />
        </div>
        <FormError>{error}</FormError>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create & build"}
        </Button>
      </form>
    </>
  );
}
