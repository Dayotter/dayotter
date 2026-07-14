"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Apple iCloud connect - a form-based flow (app-specific password) rather than an
 * OAuth redirect. Verifies credentials server-side and shows inline feedback.
 */
export function AppleConnectForm({ name, color }: { name: string; color: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/calendars/apple", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not connect");
      return;
    }
    setOpen(false);
    setUsername("");
    setPassword("");
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
          <Plus size={15} /> Connect
        </Button>
      </div>

      {open ? (
        <form
          onSubmit={connect}
          className="mt-4 space-y-3 border-t border-[var(--color-border)] pt-4"
        >
          <div>
            <Label htmlFor="apple-id">Apple ID</Label>
            <Input
              id="apple-id"
              type="email"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@icloud.com"
            />
          </div>
          <div>
            <Label htmlFor="apple-pw">App-specific password</Label>
            <Input
              id="apple-pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="xxxx-xxxx-xxxx-xxxx"
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Not your Apple password - generate one at{" "}
              <a
                href="https://account.apple.com/account/manage"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--color-accent)] hover:underline"
              >
                account.apple.com
              </a>{" "}
              → App-Specific Passwords.
            </p>
          </div>
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting ? "Connecting…" : "Connect"}
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
