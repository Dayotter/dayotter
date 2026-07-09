"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Check, Copy, KeyRound, Trash2, Webhook } from "lucide-react";
import { useEffect, useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}
interface Endpoint {
  id: string;
  url: string;
  events: string[];
  disabled: boolean;
  createdAt: string;
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-text)]"
        aria-label="Copy"
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
      </button>
    </div>
  );
}

export function DeveloperSettings({ appUrl, handle }: { appUrl: string; handle: string }) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [keyName, setKeyName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [hookUrl, setHookUrl] = useState("");
  const [newHookSecret, setNewHookSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/api-keys")
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? []))
      .catch(() => {});
    fetch("/api/webhooks")
      .then((r) => r.json())
      .then((d) => setEndpoints(d.endpoints ?? []))
      .catch(() => {});
  }, []);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: keyName }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Couldn't create the key");
    setKeys((p) => [...p, data.key]);
    setNewSecret(data.secret);
    setKeyName("");
  }

  async function revokeKey(id: string) {
    setKeys((p) => p.filter((k) => k.id !== id));
    await fetch(`/api/api-keys/${id}`, { method: "DELETE" });
  }

  async function createHook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: hookUrl, events: ["*"] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return setError(data.error ?? "Couldn't add the endpoint");
    setEndpoints((p) => [...p, data.endpoint]);
    setNewHookSecret(data.secret);
    setHookUrl("");
  }

  async function toggleHook(ep: Endpoint) {
    const disabled = !ep.disabled;
    setEndpoints((p) => p.map((x) => (x.id === ep.id ? { ...x, disabled } : x)));
    await fetch(`/api/webhooks/${ep.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ disabled }),
    });
  }

  async function deleteHook(id: string) {
    setEndpoints((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
  }

  const bookingUrl = `${appUrl}/${handle}/intro`;
  const embedSnippet = `<script src="${appUrl}/embed.js" async></script>
<div data-calsync-embed data-url="/${handle}/intro" data-height="720"></div>`;
  const popupSnippet = `<button data-calsync-popup data-url="/${handle}/intro">Book a call</button>`;

  return (
    <div className="max-w-2xl space-y-6">
      <FormError>{error}</FormError>

      {/* API keys */}
      <Card>
        <CardHeader
          title="API keys"
          description="Authenticate the REST API with a Bearer key. Base URL: /api/v1 (e.g. GET /api/v1/bookings)."
        />
        <CardBody className="space-y-4">
          {newSecret ? (
            <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-3">
              <p className="mb-2 text-xs font-medium">
                Copy your key now — it won't be shown again.
              </p>
              <CopyField value={newSecret} />
              <button
                type="button"
                onClick={() => setNewSecret(null)}
                className="mt-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Done
              </button>
            </div>
          ) : null}

          {keys.length > 0 ? (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2.5"
                >
                  <KeyRound size={15} className="text-[var(--color-faint)]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-[var(--color-faint)]">
                      {k.prefix}
                      {k.lastUsedAt
                        ? ` · used ${new Date(k.lastUsedAt).toLocaleDateString()}`
                        : " · never used"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => revokeKey(k.id)}
                    aria-label="Revoke key"
                    className="rounded p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No API keys yet.</p>
          )}

          <form onSubmit={createKey} className="flex gap-2 border-t border-[var(--color-border)] pt-4">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name (e.g. Zapier)"
              required
            />
            <Button type="submit" size="sm" disabled={!keyName.trim()}>
              Create
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader
          title="Webhooks"
          description="POSTed on booking.created / cancelled / rescheduled, signed with X-CalSync-Signature (HMAC-SHA-256 of the raw body)."
        />
        <CardBody className="space-y-4">
          {newHookSecret ? (
            <div className="rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/5 p-3">
              <p className="mb-2 text-xs font-medium">
                Signing secret — copy it now, it won't be shown again.
              </p>
              <CopyField value={newHookSecret} />
              <button
                type="button"
                onClick={() => setNewHookSecret(null)}
                className="mt-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Done
              </button>
            </div>
          ) : null}

          {endpoints.length > 0 ? (
            <ul className="space-y-2">
              {endpoints.map((ep) => (
                <li
                  key={ep.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2.5"
                >
                  <Webhook size={15} className="text-[var(--color-faint)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-xs">{ep.url}</p>
                    <p className="text-xs text-[var(--color-faint)]">
                      {ep.events.includes("*") ? "all events" : ep.events.join(", ")}
                      {ep.disabled ? " · disabled" : ""}
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                    <input
                      type="checkbox"
                      checked={!ep.disabled}
                      onChange={() => toggleHook(ep)}
                      className="accent-[var(--color-accent)]"
                    />
                    On
                  </label>
                  <button
                    type="button"
                    onClick={() => deleteHook(ep.id)}
                    aria-label="Delete endpoint"
                    className="rounded p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--color-muted)]">No endpoints yet.</p>
          )}

          <form onSubmit={createHook} className="flex gap-2 border-t border-[var(--color-border)] pt-4">
            <Input
              type="url"
              value={hookUrl}
              onChange={(e) => setHookUrl(e.target.value)}
              placeholder="https://example.com/webhooks/calsync"
              required
            />
            <Button type="submit" size="sm" disabled={!hookUrl.trim()}>
              Add
            </Button>
          </form>
        </CardBody>
      </Card>

      {/* Embed */}
      <Card>
        <CardHeader
          title="Embed on your site"
          description="Drop your booking page into any website — inline or as a popup."
        />
        <CardBody className="space-y-4">
          <div>
            <Label>Inline</Label>
            <pre className="overflow-x-auto rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-3 text-xs">
              <code>{embedSnippet}</code>
            </pre>
          </div>
          <div>
            <Label>Popup button</Label>
            <pre className="overflow-x-auto rounded-md border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-3 text-xs">
              <code>{popupSnippet}</code>
            </pre>
          </div>
          <p className="text-xs text-[var(--color-faint)]">
            Replace <code>/{handle}/intro</code> with any of your event links, e.g.{" "}
            <a href={bookingUrl} className="underline">
              {bookingUrl}
            </a>
            .
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
