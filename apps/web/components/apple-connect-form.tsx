"use client";
import { FormError } from "@/components/ui/form";

import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * CalDAV connect - a form-based flow (app-specific / account password) rather
 * than an OAuth redirect. Works with Apple iCloud, Fastmail, mailbox.org, or any
 * other CalDAV server (Nextcloud, Radicale, self-hosted). Credentials are
 * verified server-side (which also SSRF-checks a custom server URL) with inline
 * feedback.
 */

/** Known CalDAV endpoints. `url: null` = the server default (Apple iCloud);
 *  `url: "custom"` = prompt for the server URL. */
const PRESETS = [
  { id: "apple", label: "Apple iCloud", url: null as string | null, custom: false },
  { id: "fastmail", label: "Fastmail", url: "https://caldav.fastmail.com/", custom: false },
  { id: "mailbox", label: "mailbox.org", url: "https://dav.mailbox.org/", custom: false },
  { id: "other", label: "Other CalDAV server", url: null, custom: true },
] as const;

export function AppleConnectForm({ name, color }: { name: string; color: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["id"]>("apple");
  const [customUrl, setCustomUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
  const isApple = preset === "apple";

  async function connect(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const serverUrl = selected.custom ? customUrl.trim() : (selected.url ?? undefined);
    const res = await fetch("/api/calendars/apple", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password, ...(serverUrl ? { serverUrl } : {}) }),
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
    setCustomUrl("");
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
            <Label htmlFor="caldav-provider">Provider</Label>
            <select
              id="caldav-provider"
              value={preset}
              onChange={(e) => setPreset(e.target.value as (typeof PRESETS)[number]["id"])}
              className="h-10 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {selected.custom ? (
            <div>
              <Label htmlFor="caldav-url">CalDAV server URL</Label>
              <Input
                id="caldav-url"
                type="url"
                required
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://cloud.example.com/remote.php/dav"
              />
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                Must be a public HTTPS endpoint. For Nextcloud it's usually{" "}
                <code>https://your-server/remote.php/dav</code>.
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="caldav-user">{isApple ? "Apple ID" : "Email / username"}</Label>
            <Input
              id="caldav-user"
              type={isApple ? "email" : "text"}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={isApple ? "you@icloud.com" : "you@example.com"}
              autoCapitalize="none"
            />
          </div>
          <div>
            <Label htmlFor="caldav-pw">{isApple ? "App-specific password" : "Password"}</Label>
            <Input
              id="caldav-pw"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isApple ? "xxxx-xxxx-xxxx-xxxx" : "app password"}
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              {isApple ? (
                <>
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
                </>
              ) : (
                "Use an app password if your provider offers one (recommended over your main password)."
              )}
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
