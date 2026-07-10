"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Check, Copy, History, KeyRound, Send, Trash2, Webhook } from "lucide-react";
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
interface Delivery {
  id: string;
  event: string;
  status: string;
  responseStatus: number | null;
  attempts: number;
  createdAt: string;
}

const DELIVERY_COLOR: Record<string, string> = {
  success: "text-[var(--color-success)]",
  failed: "text-[var(--color-danger)]",
  pending: "text-[var(--color-muted)]",
};

/** One webhook endpoint: toggle/delete + a test ping + expandable delivery log. */
function EndpointRow({
  ep,
  onToggle,
  onDelete,
}: { ep: Endpoint; onToggle: () => void; onDelete: () => void }) {
  const [testing, setTesting] = useState(false);
  const [open, setOpen] = useState(false);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);

  async function load() {
    const d = await fetch(`/api/webhooks/${ep.id}/deliveries`)
      .then((r) => r.json())
      .catch(() => ({ deliveries: [] }));
    setDeliveries(d.deliveries ?? []);
  }
  async function test() {
    setTesting(true);
    await fetch(`/api/webhooks/${ep.id}/test`, { method: "POST" }).catch(() => {});
    setTesting(false);
    setOpen(true);
    // Give the worker a beat to deliver, then refresh.
    setTimeout(load, 800);
  }
  async function replay(deliveryId: string) {
    await fetch(`/api/webhooks/${ep.id}/replay`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    }).catch(() => {});
    setTimeout(load, 800);
  }

  return (
    <li className="rounded-md border border-[var(--color-border)]">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <Webhook size={15} className="text-[var(--color-faint)]" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-xs">{ep.url}</p>
          <p className="text-xs text-[var(--color-faint)]">
            {ep.events.includes("*") ? "all events" : ep.events.join(", ")}
            {ep.disabled ? " · disabled" : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={test}
          disabled={testing}
          title="Send test ping"
          className="rounded p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
        >
          <Send size={15} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (!open) load();
            setOpen(!open);
          }}
          title="Delivery history"
          className="rounded p-1.5 text-[var(--color-faint)] hover:text-[var(--color-text)]"
        >
          <History size={15} />
        </button>
        <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          <input
            type="checkbox"
            checked={!ep.disabled}
            onChange={onToggle}
            className="accent-[var(--color-accent)]"
          />
          On
        </label>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete endpoint"
          className="rounded p-1.5 text-[var(--color-faint)] hover:text-[var(--color-danger)]"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {open ? (
        <div className="space-y-1 border-t border-[var(--color-border)] px-3 py-2">
          {deliveries === null ? (
            <p className="text-xs text-[var(--color-faint)]">Loading…</p>
          ) : deliveries.length === 0 ? (
            <p className="text-xs text-[var(--color-faint)]">No deliveries yet.</p>
          ) : (
            deliveries.map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <span className={`font-medium ${DELIVERY_COLOR[d.status] ?? ""}`}>{d.status}</span>
                <span className="text-[var(--color-muted)]">{d.event}</span>
                <span className="text-[var(--color-faint)]">
                  {d.responseStatus ?? "—"} · try {d.attempts}
                </span>
                <span className="ml-auto text-[var(--color-faint)]">
                  {new Date(d.createdAt).toLocaleTimeString()}
                </span>
                {d.status === "failed" ? (
                  <button
                    type="button"
                    onClick={() => replay(d.id)}
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    Replay
                  </button>
                ) : null}
              </div>
            ))
          )}
        </div>
      ) : null}
    </li>
  );
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
                <EndpointRow
                  key={ep.id}
                  ep={ep}
                  onToggle={() => toggleHook(ep)}
                  onDelete={() => deleteHook(ep.id)}
                />
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
