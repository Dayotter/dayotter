"use client";

import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { track } from "@/lib/analytics";
import {
  type BookingQuestionInput,
  EVENT_COLORS,
  EVENT_COLOR_VAR,
  type EventColor,
  LOCATION_DETAIL_PLACEHOLDER,
  LOCATION_LABELS,
  LOCATION_TYPES,
  type LocationTypeValue,
  NEEDS_DETAIL,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
} from "@/lib/booking/event-type-input";
import { CURRENCIES, CURRENCY_SYMBOL } from "@/lib/booking/money";
import { Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function slugify(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DURATIONS = [15, 30, 45, 60];
const NOTICE_OPTIONS = [
  { value: 0, label: "No minimum" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 240, label: "4 hours" },
  { value: 720, label: "12 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
];
const selectClass =
  "w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]";

export interface EventTypeInitial {
  id?: string;
  title: string;
  slug: string;
  durationMinutes: number;
  description?: string | null;
  location?: LocationTypeValue;
  locationDetail?: string | null;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  minimumNoticeMinutes?: number;
  slotIntervalMinutes?: number | null;
  minimumGapMinutes?: number;
  durationOptions?: number[] | null;
  bookingWindowDays?: number;
  dailyBookingLimit?: number | null;
  isPrivate?: boolean;
  redirectUrl?: string | null;
  color?: string | null;
  price?: number | null;
  currency?: string | null;
  depositAmount?: number | null;
  questions?: BookingQuestionInput[];
}

function newQuestionId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `q_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function EventTypeForm({
  mode,
  initial,
  paymentsEnabled = false,
}: {
  mode: "create" | "edit";
  initial?: EventTypeInitial;
  paymentsEnabled?: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [duration, setDuration] = useState(initial?.durationMinutes ?? 30);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [location, setLocation] = useState<LocationTypeValue>(initial?.location ?? "google_meet");
  const [locationDetail, setLocationDetail] = useState(initial?.locationDetail ?? "");
  const [bufferBefore, setBufferBefore] = useState(initial?.bufferBeforeMinutes ?? 0);
  const [bufferAfter, setBufferAfter] = useState(initial?.bufferAfterMinutes ?? 0);
  const [minimumNotice, setMinimumNotice] = useState(initial?.minimumNoticeMinutes ?? 60);
  const [slotInterval, setSlotInterval] = useState<number | null>(
    initial?.slotIntervalMinutes ?? null,
  );
  const [minimumGap, setMinimumGap] = useState(initial?.minimumGapMinutes ?? 0);
  const [durationOptions, setDurationOptions] = useState<number[]>(initial?.durationOptions ?? []);
  const [bookingWindow, setBookingWindow] = useState(initial?.bookingWindowDays ?? 60);
  const [dailyLimitOn, setDailyLimitOn] = useState(
    initial?.dailyBookingLimit != null && initial.dailyBookingLimit > 0,
  );
  const [dailyLimit, setDailyLimit] = useState(initial?.dailyBookingLimit ?? 5);
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? false);
  const [redirectUrl, setRedirectUrl] = useState(initial?.redirectUrl ?? "");
  const [color, setColor] = useState<EventColor>(
    (initial?.color as EventColor) && EVENT_COLORS.includes(initial?.color as EventColor)
      ? (initial?.color as EventColor)
      : "violet",
  );
  const [priceOn, setPriceOn] = useState((initial?.price ?? 0) > 0);
  const [priceMajor, setPriceMajor] = useState(
    initial?.price ? (initial.price / 100).toString() : "",
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "usd");
  const [depositOn, setDepositOn] = useState((initial?.depositAmount ?? 0) > 0);
  const [depositMajor, setDepositMajor] = useState(
    initial?.depositAmount ? (initial.depositAmount / 100).toString() : "",
  );
  const [questions, setQuestions] = useState<BookingQuestionInput[]>(initial?.questions ?? []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const needsDetail = NEEDS_DETAIL.includes(location);

  function addQuestion() {
    setQuestions((qs) => [
      ...qs,
      { id: newQuestionId(), label: "", type: "text", required: false },
    ]);
  }
  function updateQuestion(id: string, patch: Partial<BookingQuestionInput>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  }
  function removeQuestion(id: string) {
    setQuestions((qs) => qs.filter((q) => q.id !== id));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const payload = {
      title,
      slug: slug || slugify(title),
      durationMinutes: duration,
      description: description || undefined,
      location,
      locationDetail: needsDetail ? locationDetail : undefined,
      bufferBeforeMinutes: bufferBefore,
      bufferAfterMinutes: bufferAfter,
      minimumNoticeMinutes: minimumNotice,
      slotIntervalMinutes: slotInterval,
      minimumGapMinutes: minimumGap,
      durationOptions:
        durationOptions.length > 0 ? [...durationOptions].sort((a, b) => a - b) : null,
      bookingWindowDays: bookingWindow,
      dailyBookingLimit: dailyLimitOn ? dailyLimit : null,
      isPrivate,
      redirectUrl: redirectUrl.trim() || null,
      color,
      price: priceOn ? Math.round((Number(priceMajor) || 0) * 100) : null,
      currency,
      depositAmount: priceOn && depositOn ? Math.round((Number(depositMajor) || 0) * 100) : null,
      questions: questions
        .filter((q) => q.label.trim().length > 0)
        .map((q) => ({
          id: q.id,
          label: q.label.trim(),
          type: q.type,
          required: q.required,
          options:
            q.type === "select"
              ? (q.options ?? []).map((o) => o.trim()).filter(Boolean)
              : undefined,
        })),
    };
    const res = await fetch(
      mode === "create" ? "/api/event-types" : `/api/event-types/${initial!.id}`,
      {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not save event type");
      return;
    }
    track(mode === "create" ? "Event Type Created" : "Event Type Updated", {
      durationMinutes: duration,
      location,
      questionCount: questions.length,
    });
    router.push("/event-types");
    router.refresh();
  }

  async function onDelete() {
    if (!initial?.id) return;
    setDeleting(true);
    const res = await fetch(`/api/event-types/${initial.id}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      setConfirmDelete(false);
      setError("Could not delete event type. Please try again.");
      return;
    }
    track("Event Type Deleted");
    router.push("/event-types");
    router.refresh();
  }

  return (
    <Card className="max-w-xl">
      <CardBody className="p-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              required
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Intro call"
            />
          </div>

          <div>
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              placeholder="intro-call"
            />
            <p className="mt-1 text-xs text-[var(--color-faint)]">
              Your link will be /your-handle/{slug || "intro-call"}
            </p>
          </div>

          <div>
            <Label htmlFor="duration">Duration</Label>
            <div className="flex items-center gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={
                    d === duration
                      ? "flex-1 rounded-md border border-[var(--color-accent)] bg-[var(--color-accent)]/10 py-2 text-sm text-[var(--color-text)]"
                      : "flex-1 rounded-md border border-[var(--color-border-strong)] py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  }
                >
                  {d}m
                </button>
              ))}
              <div className="flex items-center gap-1">
                <Input
                  aria-label="Custom duration in minutes"
                  type="number"
                  min={5}
                  max={480}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value) || 0)}
                  className="w-20"
                />
                <span className="text-sm text-[var(--color-faint)]">min</span>
              </div>
            </div>
            <div className="mt-3">
              <p className="mb-1.5 text-xs text-[var(--color-faint)]">
                Offer multiple durations (booker picks)
              </p>
              <div className="flex flex-wrap gap-2">
                {[15, 30, 45, 60, 90, 120].map((d) => {
                  const on = durationOptions.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setDurationOptions((prev) =>
                          prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
                        )
                      }
                      className={
                        on
                          ? "rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 text-sm text-[var(--color-text)]"
                          : "rounded-full border border-[var(--color-border-strong)] px-3 py-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-text)]"
                      }
                    >
                      {d}m
                    </button>
                  );
                })}
              </div>
              {durationOptions.length > 0 ? (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Bookers choose from these; {duration}m is the default.
                </p>
              ) : null}
            </div>
          </div>

          <div>
            <Label htmlFor="location">Location</Label>
            <select
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value as LocationTypeValue)}
              className={selectClass}
            >
              {LOCATION_TYPES.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCATION_LABELS[loc]}
                </option>
              ))}
            </select>
            {needsDetail ? (
              <Input
                className="mt-2"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder={LOCATION_DETAIL_PLACEHOLDER[location]}
              />
            ) : null}
          </div>

          <div>
            <Label htmlFor="description">Description (optional)</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's this meeting about?"
              className="w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            />
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
              Scheduling rules
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="buffer-before">Buffer before</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="buffer-before"
                    type="number"
                    min={0}
                    max={240}
                    value={bufferBefore}
                    onChange={(e) => setBufferBefore(Number(e.target.value) || 0)}
                  />
                  <span className="text-sm text-[var(--color-faint)]">min</span>
                </div>
              </div>
              <div>
                <Label htmlFor="buffer-after">Buffer after</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="buffer-after"
                    type="number"
                    min={0}
                    max={240}
                    value={bufferAfter}
                    onChange={(e) => setBufferAfter(Number(e.target.value) || 0)}
                  />
                  <span className="text-sm text-[var(--color-faint)]">min</span>
                </div>
              </div>
              <div>
                <Label htmlFor="min-notice">Minimum notice</Label>
                <select
                  id="min-notice"
                  value={minimumNotice}
                  onChange={(e) => setMinimumNotice(Number(e.target.value))}
                  className={selectClass}
                >
                  {NOTICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="booking-window">Bookable up to</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="booking-window"
                    type="number"
                    min={1}
                    max={730}
                    value={bookingWindow}
                    onChange={(e) => setBookingWindow(Number(e.target.value) || 1)}
                  />
                  <span className="text-sm text-[var(--color-faint)]">days out</span>
                </div>
              </div>
              <div>
                <Label htmlFor="slot-interval">Show slots every</Label>
                <select
                  id="slot-interval"
                  value={slotInterval ?? 0}
                  onChange={(e) => setSlotInterval(Number(e.target.value) || null)}
                  className={selectClass}
                >
                  <option value={0}>Every {duration} min (default)</option>
                  {[10, 15, 20, 30, 60].map((v) => (
                    <option key={v} value={v}>
                      {v} min
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="min-gap">Gap between bookings</Label>
                <div className="flex items-center gap-1">
                  <Input
                    id="min-gap"
                    type="number"
                    min={0}
                    max={240}
                    value={minimumGap}
                    onChange={(e) => setMinimumGap(Number(e.target.value) || 0)}
                  />
                  <span className="text-sm text-[var(--color-faint)]">min</span>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-[var(--color-border)] p-3">
              <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                <input
                  type="checkbox"
                  checked={dailyLimitOn}
                  onChange={(e) => setDailyLimitOn(e.target.checked)}
                  className="accent-[var(--color-accent)]"
                />
                Limit bookings per day
              </label>
              {dailyLimitOn ? (
                <div className="mt-2 flex items-center gap-1">
                  <Input
                    aria-label="Maximum bookings per day"
                    type="number"
                    min={1}
                    max={100}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value) || 1)}
                    className="w-20"
                  />
                  <span className="text-sm text-[var(--color-faint)]">bookings max per day</span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-[var(--color-faint)]">
                  Cap how many times this can be booked in a single day.
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
              Advanced
            </p>
            <label className="flex items-start gap-2 text-sm text-[var(--color-text)]">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="mt-0.5 accent-[var(--color-accent)]"
              />
              <span>
                Private
                <span className="mt-0.5 block text-xs text-[var(--color-faint)]">
                  Hidden from your public booking page. Still bookable by anyone with the direct
                  link.
                </span>
              </span>
            </label>
            <div className="mt-4">
              <Label htmlFor="redirect-url">Redirect after booking (optional)</Label>
              <Input
                id="redirect-url"
                type="url"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://example.com/thanks"
              />
              <p className="mt-1 text-xs text-[var(--color-faint)]">
                Send bookers here instead of the calSync confirmation page.
              </p>
            </div>
            <div className="mt-4">
              <Label>Colour</Label>
              <div className="flex items-center gap-2.5">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    aria-pressed={color === c}
                    className={
                      color === c
                        ? "h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-[var(--color-surface)] ring-[var(--color-text)]"
                        : "h-8 w-8 rounded-full ring-1 ring-inset ring-black/10"
                    }
                    style={{ backgroundColor: EVENT_COLOR_VAR[c] }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-faint)]">
                Tags this event across your dashboard, calendar, and bookings.
              </p>
            </div>

            {paymentsEnabled ? (
              <div className="mt-4 rounded-md border border-[var(--color-border)] p-3">
                <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
                  <input
                    type="checkbox"
                    checked={priceOn}
                    onChange={(e) => setPriceOn(e.target.checked)}
                    className="accent-[var(--color-accent)]"
                  />
                  Require payment to book
                </label>
                {priceOn ? (
                  <div className="mt-3 space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label htmlFor="price">Price</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-sm text-[var(--color-muted)]">
                            {CURRENCY_SYMBOL[currency as keyof typeof CURRENCY_SYMBOL]}
                          </span>
                          <Input
                            id="price"
                            type="number"
                            min={0}
                            step="0.01"
                            value={priceMajor}
                            onChange={(e) => setPriceMajor(e.target.value)}
                            placeholder="25.00"
                          />
                        </div>
                      </div>
                      <div className="w-28">
                        <Label htmlFor="currency">Currency</Label>
                        <Select
                          id="currency"
                          value={currency}
                          onChange={(e) => setCurrency(e.target.value)}
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c.toUpperCase()}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                      <input
                        type="checkbox"
                        checked={depositOn}
                        onChange={(e) => setDepositOn(e.target.checked)}
                        className="accent-[var(--color-accent)]"
                      />
                      Take a deposit instead of the full price
                    </label>
                    {depositOn ? (
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-[var(--color-muted)]">
                          {CURRENCY_SYMBOL[currency as keyof typeof CURRENCY_SYMBOL]}
                        </span>
                        <Input
                          aria-label="Deposit amount"
                          type="number"
                          min={0}
                          step="0.01"
                          value={depositMajor}
                          onChange={(e) => setDepositMajor(e.target.value)}
                          placeholder="10.00"
                          className="w-32"
                        />
                        <span className="text-xs text-[var(--color-faint)]">charged to book</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[var(--color-faint)]">
                    Collect payment via Stripe before the booking is confirmed.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--color-border)] pt-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-faint)]">
              Booking questions
            </p>
            <p className="mb-3 text-sm text-[var(--color-muted)]">
              Ask bookers for extra details. Name and email are always collected.
            </p>
            {questions.length > 0 ? (
              <div className="mb-3 space-y-3">
                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="space-y-2 rounded-md border border-[var(--color-border)] p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={q.label}
                        onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                        placeholder="e.g. What would you like to discuss?"
                      />
                      <button
                        type="button"
                        onClick={() => removeQuestion(q.id)}
                        aria-label="Remove question"
                        className="shrink-0 rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-danger)]"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <Select
                        value={q.type}
                        onChange={(e) =>
                          updateQuestion(q.id, {
                            type: e.target.value as BookingQuestionInput["type"],
                          })
                        }
                        className="max-w-[160px]"
                      >
                        {QUESTION_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {QUESTION_TYPE_LABELS[t]}
                          </option>
                        ))}
                      </Select>
                      <label className="flex items-center gap-1.5 text-sm text-[var(--color-muted)]">
                        <input
                          type="checkbox"
                          checked={q.required}
                          onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                          className="accent-[var(--color-accent)]"
                        />
                        Required
                      </label>
                    </div>
                    {q.type === "select" ? (
                      <Input
                        value={(q.options ?? []).join(", ")}
                        onChange={(e) =>
                          updateQuestion(q.id, { options: e.target.value.split(",") })
                        }
                        placeholder="Option 1, Option 2, Option 3"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus size={15} /> Add question
            </Button>
          </div>

          <FormError>{error}</FormError>

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : mode === "create" ? "Create event type" : "Save changes"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
            {mode === "edit" ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-danger)]"
              >
                <Trash2 size={15} /> Delete
              </button>
            ) : null}
          </div>
        </form>
      </CardBody>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Delete this event type?"
        description="People will no longer be able to book it. Existing bookings are kept. This can't be undone."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </Card>
  );
}
