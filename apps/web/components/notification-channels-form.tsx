"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import { CHANNEL_LABELS } from "@/lib/notifications/channel-input";
import {
  Bell,
  Check,
  MessageSquare,
  Monitor,
  Phone,
  Slack,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useState } from "react";

type ChannelType = "slack" | "whatsapp" | "sms" | "push" | "webpush";

/** VAPID public key from the server — present only when web push is configured. */
const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** Decode a base64url VAPID key into the bytes PushManager.subscribe expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

interface Channel {
  id: string;
  type: string;
  label: string;
  isVerified: boolean;
  remindersEnabled: boolean;
}

const ICONS: Record<string, typeof Slack> = {
  slack: Slack,
  whatsapp: MessageSquare,
  sms: Phone,
  push: Smartphone,
  webpush: Monitor,
};

export function NotificationChannelsForm({
  initialChannels,
  available,
}: {
  initialChannels: Channel[];
  available: ChannelType[];
}) {
  const [channels, setChannels] = useState<Channel[]>(initialChannels);
  // Web push is added via the browser subscribe flow, not the type dropdown.
  const typeOptions = available.filter((t) => t !== "webpush");
  const webPushAvailable = available.includes("webpush") && Boolean(VAPID_KEY);
  const hasWebPush = channels.some((c) => c.type === "webpush");
  const [type, setType] = useState<ChannelType>(typeOptions[0] ?? "slack");
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [pushToken, setPushToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Channel | null>(null);
  const [deleting, setDeleting] = useState(false);

  function payloadFor(): Record<string, unknown> {
    if (type === "slack") return { type, webhookUrl: webhookUrl.trim() };
    if (type === "push") return { type, pushToken: pushToken.trim() };
    return { type, phone: phone.trim() };
  }

  async function addChannel(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);
    const res = await fetch("/api/settings/channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadFor()),
    });
    setAdding(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string"
          ? data.error
          : "Couldn't add that channel. Check the details and try again.",
      );
      return;
    }
    track("Notification Channel Added", { type });
    setChannels((prev) => [...prev, data.channel]);
    setWebhookUrl("");
    setPhone("");
    setPushToken("");
  }

  /**
   * Opt into browser notifications: prompt for permission, register the service
   * worker, subscribe via VAPID, and store the subscription as a webpush channel.
   */
  async function enableWebPush() {
    setPushError(null);
    if (!VAPID_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushError("This browser doesn't support push notifications.");
      return;
    }
    setEnablingPush(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushError("Notifications are blocked. Enable them in your browser settings and retry.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      const res = await fetch("/api/settings/channels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "webpush", subscription: sub.toJSON() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushError(
          typeof data.error === "string" ? data.error : "Couldn't enable browser notifications.",
        );
        return;
      }
      track("Notification Channel Added", { type: "webpush" });
      setChannels((prev) => [...prev, data.channel]);
    } catch (e) {
      setPushError(e instanceof Error ? e.message : "Couldn't enable browser notifications.");
    } finally {
      setEnablingPush(false);
    }
  }

  async function toggle(ch: Channel) {
    const next = !ch.remindersEnabled;
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, remindersEnabled: next } : c)));
    const res = await fetch(`/api/settings/channels/${ch.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ remindersEnabled: next }),
    });
    if (!res.ok) {
      // Roll back on failure.
      setChannels((prev) =>
        prev.map((c) => (c.id === ch.id ? { ...c, remindersEnabled: !next } : c)),
      );
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    const res = await fetch(`/api/settings/channels/${pendingDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (res.ok) {
      setChannels((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      track("Notification Channel Removed", { type: pendingDelete.type });
    }
    setPendingDelete(null);
  }

  return (
    <Card className="max-w-xl">
      <CardHeader
        title="Notification channels"
        description="Get meeting reminders where you actually are — Slack, WhatsApp, SMS, or your phone. Email reminders are always on."
      />
      <CardBody className="space-y-5">
        {webPushAvailable && !hasWebPush ? (
          <div className="flex items-start gap-3 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] px-4 py-3.5">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--color-accent)] text-white">
              <Bell size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Turn on browser notifications</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                Get a desktop nudge before each meeting — even when DayOtter isn't open. You can
                turn it off anytime.
              </p>
              {pushError ? (
                <p className="mt-2 text-xs text-[var(--color-danger)]">{pushError}</p>
              ) : null}
              <Button
                type="button"
                className="mt-2.5"
                onClick={enableWebPush}
                disabled={enablingPush}
              >
                {enablingPush ? "Enabling…" : "Enable on this browser"}
              </Button>
            </div>
          </div>
        ) : null}

        {channels.length > 0 ? (
          <ul className="space-y-2">
            {channels.map((ch) => {
              const Icon = ICONS[ch.type] ?? MessageSquare;
              return (
                <li
                  key={ch.id}
                  className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-4 py-3"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--color-surface-2)] text-[var(--color-accent)]">
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {CHANNEL_LABELS[ch.type as ChannelType] ?? ch.type}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">{ch.label}</p>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                    <input
                      type="checkbox"
                      checked={ch.remindersEnabled}
                      onChange={() => toggle(ch)}
                      className="accent-[var(--color-accent)]"
                    />
                    Reminders
                  </label>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(ch)}
                    aria-label="Remove channel"
                    className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No extra channels yet. Add one below and we'll send a test message to confirm it works.
          </p>
        )}

        <form
          onSubmit={addChannel}
          className="space-y-3 border-t border-[var(--color-border)] pt-4"
        >
          <div>
            <Label htmlFor="channel-type">Add a channel</Label>
            <Select
              id="channel-type"
              value={type}
              onChange={(e) => {
                setType(e.target.value as ChannelType);
                setError(null);
              }}
            >
              {typeOptions.map((t) => (
                <option key={t} value={t}>
                  {CHANNEL_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          {type === "slack" ? (
            <div>
              <Label htmlFor="slack-webhook">Slack incoming webhook URL</Label>
              <Input
                id="slack-webhook"
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/…"
              />
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                Create one at api.slack.com → Incoming Webhooks, then paste it here.
              </p>
            </div>
          ) : null}

          {type === "whatsapp" || type === "sms" ? (
            <div>
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+14155551234"
              />
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                International format, including country code.
              </p>
            </div>
          ) : null}

          {type === "push" ? (
            <div>
              <Label htmlFor="push-token">Expo push token</Label>
              <Input
                id="push-token"
                value={pushToken}
                onChange={(e) => setPushToken(e.target.value)}
                placeholder="ExponentPushToken[…]"
              />
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                The DayOtter mobile app registers this for you automatically.
              </p>
            </div>
          ) : null}

          <FormError>{error}</FormError>

          <Button type="submit" disabled={adding}>
            {adding ? (
              "Sending test…"
            ) : (
              <>
                <Check size={15} /> Add & verify
              </>
            )}
          </Button>
        </form>
      </CardBody>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Remove this channel?"
        description="You'll stop receiving reminders here. You can add it back anytime."
        confirmLabel="Remove"
        danger
        loading={deleting}
      />
    </Card>
  );
}
