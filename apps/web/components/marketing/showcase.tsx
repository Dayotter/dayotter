"use client";

import { Reveal, Stagger } from "@/components/marketing/motion";
import { BrandMark } from "@/components/brand-mark";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS } from "@/lib/comparisons";
import { ArrowRight, Check, Minus, Sparkles, Sun } from "lucide-react";
import Link from "next/link";

/* ------------------------------------------------------------------ */
/* A day with Otter — a timeline of the product living in a real day.  */
/* ------------------------------------------------------------------ */

const MOMENTS = [
  {
    time: "7:30",
    label: "Morning briefing",
    body: "Otter texts you the day: three meetings, two hours of focus held, and a heads-up that your 10am moved to dodge a clash.",
  },
  {
    time: "9:15",
    label: "Just ask",
    body: '"Book 30 minutes with the design candidate on Thursday." Otter drafts it, picks a clear slot, and waits for your OK.',
  },
  {
    time: "11:00",
    label: "Focus, defended",
    body: "Two hours of deep work, held as real events. New meetings route around them instead of eating into them.",
  },
  {
    time: "2:20",
    label: "Running behind",
    body: "Your 1:1 ran long. Otter quietly pings your 2:30 that you're ten minutes out — no awkward apology needed.",
  },
  {
    time: "6:00",
    label: "Evening recap",
    body: "Tomorrow opens with the Acme review at 9, notes and action items attached. Nothing to chase, nothing forgotten.",
  },
];

export function DayWithOtter() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">A day with Otter</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          It works the whole day, so you don't have to.
        </h2>
        <p className="mt-4 text-lg text-[var(--color-muted)]">
          Not a booking link you forget about — an assistant that shows up from your first coffee to
          your last meeting.
        </p>
      </Reveal>

      <div className="relative mt-16">
        {/* the spine */}
        <div
          className="absolute bottom-2 left-[68px] top-2 w-px bg-[var(--color-border)] sm:left-[84px]"
          aria-hidden
        />
        <Stagger className="space-y-8">
          {MOMENTS.map((m) => (
            <Stagger.Item key={m.time}>
              <div className="relative flex gap-5 sm:gap-7">
                <div className="w-[52px] shrink-0 pt-1 text-right sm:w-[64px]">
                  <span className="font-mono text-sm font-medium text-[var(--color-accent)]">
                    {m.time}
                  </span>
                </div>
                <div className="relative">
                  <span
                    className="absolute -left-[22px] top-[6px] h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-accent)] sm:-left-[26px]"
                    aria-hidden
                  />
                  <p className="text-[15px] font-semibold">{m.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--color-muted)]">
                    {m.body}
                  </p>
                </div>
              </div>
            </Stagger.Item>
          ))}
        </Stagger>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Otter demo — a scripted look at the assistant, styled like the app. */
/* ------------------------------------------------------------------ */

export function OtterDemo() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow">See it work</span>
          <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
            Say it once. Watch it happen.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--color-muted)]">
            Talk to Otter the way you'd talk to an assistant — in the app, or over WhatsApp and SMS.
            It reads your real availability, drafts the change, and never touches your calendar until
            you say go.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Understands plain language, across every timezone",
              "Confirm-first — it proposes, you approve",
              "Works over chat, voice, WhatsApp and SMS",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)]">
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
              <BrandMark size={18} />
              <span className="text-sm font-semibold tracking-tight">Ask Otter</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-faint)]">
                <Sparkles size={12} /> you confirm first
              </span>
            </div>

            <div className="space-y-3">
              {/* user bubble */}
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-[var(--color-accent)] px-4 py-2.5 text-sm text-white">
                  Move my 3pm with Dana to Thursday afternoon
                </p>
              </div>
              {/* otter proposal */}
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-[var(--color-surface-2)] px-4 py-3">
                  <p className="text-sm text-[var(--color-text)]">
                    Found a clear slot. Here's the move:
                  </p>
                  <div className="mt-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                      Reschedule
                    </p>
                    <p className="mt-1 text-sm font-semibold">1:1 with Dana</p>
                    <p className="text-sm text-[var(--color-muted)]">
                      <span className="line-through">Tue 3:00 PM</span> → Thu 2:30 PM · 30 min
                    </p>
                    <div className="mt-3 flex gap-2">
                      <span
                        className={`${buttonVariants({ variant: "primary" })} pointer-events-none h-8 px-3 text-xs`}
                      >
                        Confirm
                      </span>
                      <span
                        className={`${buttonVariants({ variant: "ghost" })} pointer-events-none h-8 px-3 text-xs`}
                      >
                        Edit
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compare teaser — a compact table linking to the full /vs pages.     */
/* ------------------------------------------------------------------ */

type Cell = { text: string; edge?: "us" | "them" };
const TEASER_ROWS: { label: string; dayotter: Cell; calendly: Cell; calcom: Cell }[] = [
  {
    label: "Free plan",
    dayotter: { text: "Unlimited event types", edge: "us" },
    calendly: { text: "One event type" },
    calcom: { text: "Generous" },
  },
  {
    label: "Teams",
    dayotter: { text: "$9 / seat", edge: "us" },
    calendly: { text: "$16–20 / seat" },
    calcom: { text: "Higher tiers" },
  },
  {
    label: "AI assistant",
    dayotter: { text: "Otter, included", edge: "us" },
    calendly: { text: "Routing only" },
    calcom: { text: "Metered voice add-on" },
  },
  {
    label: "Focus protection",
    dayotter: { text: "Built in", edge: "us" },
    calendly: { text: "None" },
    calcom: { text: "None" },
  },
  {
    label: "Open source",
    dayotter: { text: "Yes", edge: "us" },
    calendly: { text: "No" },
    calcom: { text: "Yes" },
  },
];

function TeaserCell({ cell, strong }: { cell: Cell; strong?: boolean }) {
  const win = cell.edge === "us";
  return (
    <td
      className={`px-4 py-3.5 text-sm ${
        strong
          ? "bg-[var(--color-accent-soft)]/40 font-medium text-[var(--color-text)]"
          : "text-[var(--color-muted)]"
      }`}
    >
      <span className="flex items-center gap-1.5">
        {win ? (
          <Check size={14} className="shrink-0 text-[var(--color-accent)]" />
        ) : (
          <Minus size={14} className="shrink-0 text-[var(--color-faint)]" />
        )}
        {cell.text}
      </span>
    </td>
  );
}

export function CompareTeaser() {
  const count = COMPARISONS.length;
  return (
    <section className="mx-auto max-w-4xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">How we stack up</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          The same scheduling. More for less.
        </h2>
      </Reveal>
      <Reveal className="mt-12">
        <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[520px] border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-faint)]">
                  &nbsp;
                </th>
                <th className="bg-[var(--color-accent-soft)]/40 px-4 py-3.5 text-left text-sm font-semibold">
                  <span className="flex items-center gap-1.5">
                    <BrandMark size={16} /> DayOtter
                  </span>
                </th>
                <th className="px-4 py-3.5 text-left text-sm font-semibold text-[var(--color-muted)]">
                  Calendly
                </th>
                <th className="px-4 py-3.5 text-left text-sm font-semibold text-[var(--color-muted)]">
                  Cal.com
                </th>
              </tr>
            </thead>
            <tbody>
              {TEASER_ROWS.map((r) => (
                <tr
                  key={r.label}
                  className="border-b border-[var(--color-border)] last:border-0"
                >
                  <td className="px-4 py-3.5 text-sm font-medium">{r.label}</td>
                  <TeaserCell cell={r.dayotter} strong />
                  <TeaserCell cell={r.calendly} />
                  <TeaserCell cell={r.calcom} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/vs"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)] hover:underline"
          >
            See all {count} head-to-head comparisons
            <ArrowRight size={15} />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}
