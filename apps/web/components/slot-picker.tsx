"use client";
import { FormError } from "@/components/ui/form";

import { type Slot, SlotGrid, useLocalZone } from "@/components/slot-grid";
import { Turnstile, captchaEnabled } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import type { BookingQuestionInput } from "@/lib/booking/event-type-input";
import { type Locale, t } from "@/lib/i18n/booking";
import { useBookingLocale } from "@/lib/i18n/use-locale";
import { ArrowLeft, Lock } from "lucide-react";
import { DateTime } from "luxon";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SlotPicker({
  eventTypeId,
  questions = [],
  priceLabel = null,
  defaultDuration,
  durationOptions = [],
  linkToken,
  requiresCode = false,
}: {
  eventTypeId: string;
  questions?: BookingQuestionInput[];
  priceLabel?: string | null;
  defaultDuration: number;
  durationOptions?: number[];
  /** When booking through a single-use link, carried so the server consumes it. */
  linkToken?: string;
  /** Event type is password-protected — gate the flow behind an access code. */
  requiresCode?: boolean;
}) {
  const router = useRouter();
  const zone = useLocalZone();
  const locale = useBookingLocale();
  const hasDurations = durationOptions.length > 0;
  const [accessCode, setAccessCode] = useState<string | null>(requiresCode ? null : "");
  const [duration, setDuration] = useState(defaultDuration);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setAnswer(id: string, value: string | boolean) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }

  function addGuest() {
    const g = guestInput.trim().toLowerCase();
    if (g && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(g) && !guests.includes(g) && guests.length < 10) {
      setGuests((prev) => [...prev, g]);
      setGuestInput("");
    }
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;

    // Client-side required-answer check (server re-validates).
    const missing = questions.find((q) => {
      if (!q.required) return false;
      const v = answers[q.id];
      return q.type === "checkbox" ? v !== true : !v || String(v).trim() === "";
    });
    if (missing) {
      setError(t(locale, "pleaseAnswer", { label: missing.label }));
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventTypeId,
        start: selected.start,
        attendee: { name, email, timezone: zone },
        guests: guests.length ? guests : undefined,
        notes: notes || undefined,
        responses: questions.length ? answers : undefined,
        durationMinutes: hasDurations ? duration : undefined,
        captchaToken: captchaToken || undefined,
        linkToken: linkToken || undefined,
        accessCode: accessCode || undefined,
        returnPath: typeof window !== "undefined" ? window.location.pathname : undefined,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setSubmitting(false);
      track("Booking Failed", { eventTypeId, status: res.status });
      setError(typeof data.error === "string" ? data.error : t(locale, "bookingFailed"));
      return;
    }
    const data = await res.json();
    // Paid event type → hand off to Stripe Checkout.
    if (typeof data.checkoutUrl === "string") {
      track("Booking Checkout Started", { eventTypeId });
      window.location.href = data.checkoutUrl;
      return;
    }
    track("Booking Confirmed", { eventTypeId });
    // Honor a host-configured redirect (external URL) over the DayOtter confirmation.
    if (typeof data.redirectUrl === "string" && /^https?:\/\//.test(data.redirectUrl)) {
      window.location.href = data.redirectUrl;
      return;
    }
    router.push(data.url as `/${string}`);
  }

  const durationSelector = hasDurations ? (
    <div className="mb-4">
      <Label>{t(locale, "duration")}</Label>
      <div className="flex flex-wrap gap-2">
        {durationOptions.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            className={
              d === duration
                ? "rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1.5 text-sm text-[var(--color-text)]"
                : "rounded-md border border-[var(--color-border-strong)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
            }
          >
            {t(locale, "durationMin", { n: d })}
          </button>
        ))}
      </div>
    </div>
  ) : null;

  // Password-protected event type: gate everything behind the access code.
  if (requiresCode && accessCode === null) {
    return <AccessGate eventTypeId={eventTypeId} locale={locale} onVerified={setAccessCode} />;
  }

  if (!selected) {
    return (
      <div>
        {durationSelector}
        <SlotGrid
          eventTypeId={eventTypeId}
          onSelect={setSelected}
          duration={hasDurations ? duration : undefined}
        />
      </div>
    );
  }

  return (
    <form onSubmit={confirm}>
      <button
        type="button"
        onClick={() => setSelected(null)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={15} /> {t(locale, "back")}
      </button>
      <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 text-sm">
        {DateTime.fromISO(selected.start).setZone(zone).toFormat("cccc, LLLL d 'at' h:mm a")}
        <span className="text-[var(--color-muted)]"> · {zone}</span>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="b-name">{t(locale, "yourName")}</Label>
          <Input
            id="b-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ada Lovelace"
          />
        </div>
        <div>
          <Label htmlFor="b-email">{t(locale, "email")}</Label>
          <Input
            id="b-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        <div>
          <Label htmlFor="b-guest">{t(locale, "guestsOptional")}</Label>
          <div className="flex gap-2">
            <Input
              id="b-guest"
              type="email"
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest();
                }
              }}
              placeholder="colleague@company.com"
            />
            <Button type="button" variant="outline" onClick={addGuest}>
              {t(locale, "add")}
            </Button>
          </div>
          {guests.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {guests.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] px-2.5 py-1 text-xs text-[var(--color-text)]"
                >
                  {g}
                  <button
                    type="button"
                    onClick={() => setGuests((prev) => prev.filter((x) => x !== g))}
                    aria-label={`Remove ${g}`}
                    className="text-[var(--color-faint)] hover:text-[var(--color-danger)]"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <div>
          <Label htmlFor="b-notes">{t(locale, "notesOptional")}</Label>
          <textarea
            id="b-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t(locale, "notesPlaceholder")}
            className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          />
        </div>
        {questions.map((q) => {
          const fieldId = `q-${q.id}`;
          if (q.type === "checkbox") {
            return (
              <label key={q.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={answers[q.id] === true}
                  onChange={(e) => setAnswer(q.id, e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                {q.label}
                {q.required ? <span className="text-[var(--color-danger)]">*</span> : null}
              </label>
            );
          }
          return (
            <div key={q.id}>
              <Label htmlFor={fieldId}>
                {q.label}
                {q.required ? <span className="text-[var(--color-danger)]"> *</span> : null}
              </Label>
              {q.type === "textarea" ? (
                <textarea
                  id={fieldId}
                  rows={3}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                  className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                />
              ) : q.type === "select" ? (
                <Select
                  id={fieldId}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                >
                  <option value="" disabled>
                    {t(locale, "selectPlaceholder")}
                  </option>
                  {(q.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id={fieldId}
                  type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : "text"}
                  required={q.required}
                  value={(answers[q.id] as string) ?? ""}
                  onChange={(e) => setAnswer(q.id, e.target.value)}
                />
              )}
            </div>
          );
        })}
        <Turnstile onToken={setCaptchaToken} />
        <FormError>{error}</FormError>
        <Button
          type="submit"
          className="w-full"
          disabled={submitting || (captchaEnabled && !captchaToken)}
        >
          {submitting
            ? t(locale, "confirming")
            : priceLabel
              ? t(locale, "payAndBook", { price: priceLabel })
              : t(locale, "confirmBooking")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Access-code gate for a password-protected event type. Verifies the code
 * server-side, then hands it back so the booking request can re-present it.
 */
function AccessGate({
  eventTypeId,
  locale,
  onVerified,
}: {
  eventTypeId: string;
  locale: Locale;
  onVerified: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/event-types/${eventTypeId}/verify-code`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    const data = await res.json().catch(() => ({ ok: false }));
    setSubmitting(false);
    if (res.ok && data.ok) onVerified(code.trim());
    else setError(t(locale, "accessWrong"));
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <Lock size={15} /> {t(locale, "accessHint")}
      </p>
      <div>
        <Label htmlFor="access-code">{t(locale, "accessRequired")}</Label>
        <Input
          id="access-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoFocus
          autoComplete="off"
        />
      </div>
      <FormError>{error}</FormError>
      <Button type="submit" className="w-full" disabled={submitting || !code.trim()}>
        {submitting ? t(locale, "confirming") : t(locale, "accessSubmit")}
      </Button>
    </form>
  );
}
