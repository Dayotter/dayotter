"use client";

import { BrandMark } from "@/components/brand-mark";
import { Reveal, Stagger } from "@/components/marketing/motion";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS } from "@/lib/comparisons";
import { ArrowRight, CalendarClock, Check, Focus, Info, Minus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ */
/* A day with Otter - a timeline of the product living in a real day.  */
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
    body: "Your 1:1 ran long. Otter quietly pings your 2:30 that you're ten minutes out - no awkward apology needed.",
  },
  {
    time: "6:00",
    label: "Evening recap",
    body: "Tomorrow opens with the Acme review at 9, notes and action items attached. Nothing to chase, nothing forgotten.",
  },
];

export function DayWithOtter() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">A day with Otter</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          It works the whole day, so you don't have to.
        </h2>
        <p className="mt-4 text-lg text-[var(--color-muted)]">
          Not a booking link you forget about - an assistant that shows up from your first coffee to
          your last meeting.
        </p>
      </Reveal>

      <div className="relative mx-auto mt-16 max-w-2xl">
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
/* Otter demo - a scripted look at the assistant, styled like the app. */
/* ------------------------------------------------------------------ */

/**
 * A safe, client-side "try Otter" sandbox. Matches a typed command to a canned
 * proposed action - no backend, no AI cost, no auth - so a visitor can feel the
 * confirm-first behaviour before signing up. (In the product this is a real,
 * availability-aware model call.)
 */
type DemoReply =
  | { type: "create" | "focus" | "reschedule"; label: string; title: string; detail: string }
  | { type: "info"; label: string; title: string; detail: string };

function interpretDemo(text: string): DemoReply {
  const t = text.toLowerCase();
  if (/\b(hold|focus|deep work|block)\b/.test(t)) {
    return {
      type: "focus",
      label: "Focus block",
      title: "Deep work",
      detail: "Tomorrow · 9:00–11:00 AM · held as busy",
    };
  }
  if (/\b(move|resched|push|shift)\b/.test(t)) {
    return {
      type: "reschedule",
      label: "Reschedule",
      title: "1:1 with Dana",
      // The tedious part was never moving the event - it's telling everyone.
      // Say that out loud, because it's the whole point.
      detail: "Tue 3:00 PM → Thu 2:30 PM · Dana and 2 guests notified",
    };
  }
  if (/\b(free|available|when can|open)\b/.test(t)) {
    return {
      type: "info",
      label: "Availability",
      title: "You're open Wednesday afternoon",
      detail: "2:00, 2:30 and 4:00 PM are all clear.",
    };
  }
  return {
    type: "create",
    label: "Meeting",
    title: /with\s+(\w+)/.exec(t)?.[1] ? `Intro with ${/with\s+(\w+)/.exec(t)![1]}` : "Intro call",
    detail: "Thu 2:00 PM · 30 min · Google Meet",
  };
}

/**
 * The first entry is the one the demo types out by itself - lead with the
 * reschedule, because "move it and tell everyone" is the chore people recognise
 * instantly.
 */
const DEMO_CHIPS = [
  "Move my 3pm to Thursday and let everyone know",
  "Book a 30-min intro with Sam Thursday 2pm",
  "Hold two hours for deep work tomorrow",
  "Am I free Wednesday afternoon?",
];

const DEMO_ICON = {
  create: CalendarClock,
  focus: Focus,
  reschedule: CalendarClock,
  info: Info,
} as const;

/** Typing cadence for the scroll-triggered replay. */
const TYPE_MS = 34;
const SETTLE_MS = 420;

export function OtterDemo() {
  const [text, setText] = useState<string>(DEMO_CHIPS[0] ?? "");
  const [reply, setReply] = useState<DemoReply>(() => interpretDemo(DEMO_CHIPS[0] ?? ""));
  // `revealed` starts true so SSR, no-JS and reduced-motion all render exactly
  // what this demo has always rendered - the replay is purely additive.
  const [revealed, setRevealed] = useState(true);
  const hostRef = useRef<HTMLDivElement>(null);
  const played = useRef(false);
  const touched = useRef(false);

  function run(next: string) {
    touched.current = true;
    setText(next);
    setReply(interpretDemo(next));
    setRevealed(true);
  }

  /**
   * The first time the demo scrolls into view, rewind and type the lead example
   * out, so the value lands without the visitor doing anything. Any real
   * interaction cancels it - never fight the user.
   */
  useEffect(() => {
    const lead = DEMO_CHIPS[0];
    const host = hostRef.current;
    if (!lead || !host) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || played.current || touched.current) return;
        played.current = true;
        observer.disconnect();

        setRevealed(false);
        setText("");
        for (let i = 1; i <= lead.length; i++) {
          timers.push(
            setTimeout(() => {
              if (!touched.current) setText(lead.slice(0, i));
            }, i * TYPE_MS),
          );
        }
        timers.push(
          setTimeout(
            () => {
              if (!touched.current) {
                setReply(interpretDemo(lead));
                setRevealed(true);
              }
            },
            lead.length * TYPE_MS + SETTLE_MS,
          ),
        );
      },
      { threshold: 0.4 },
    );
    observer.observe(host);
    return () => {
      observer.disconnect();
      for (const t of timers) clearTimeout(t);
    };
  }, []);

  const Icon = DEMO_ICON[reply.type];
  const isInfo = reply.type === "info";

  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <span className="eyebrow">Try it yourself</span>
          <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
            Say it once. Watch it happen.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-[var(--color-muted)]">
            Type a request - or tap an example. Otter drafts the change and waits for your OK. In
            the app it reads your real availability and works over chat, voice, WhatsApp and SMS.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Understands plain language, across every timezone",
              "Confirm-first - it proposes, you approve",
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
          <div
            ref={hostRef}
            className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-float)]"
          >
            <div className="mb-4 flex items-center gap-2 border-b border-[var(--color-border)] pb-3">
              <BrandMark size={18} />
              <span className="text-sm font-semibold tracking-tight">Ask Otter</span>
              <span className="ml-auto flex items-center gap-1 text-xs text-[var(--color-faint)]">
                <Sparkles size={12} /> you confirm first
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(text);
              }}
              className="flex gap-2"
            >
              <input
                value={text}
                onChange={(e) => {
                  touched.current = true;
                  setText(e.target.value);
                }}
                aria-label="Ask Otter"
                className="min-w-0 flex-1 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
              />
              <button
                type="submit"
                className={`${buttonVariants({ variant: "primary" })} h-9 px-4 text-sm`}
              >
                Go
              </button>
            </form>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {DEMO_CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => run(c)}
                  className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                >
                  {c.length > 34 ? `${c.slice(0, 32)}…` : c}
                </button>
              ))}
            </div>

            {/* Height is reserved so the replay's reveal never shifts the layout. */}
            <div className="mt-4 min-h-[118px]">
              {revealed ? (
                <div className="animate-dialog-in rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-accent)]">
                    <Icon size={13} /> {reply.label}
                  </p>
                  <p className="mt-1.5 text-sm font-semibold">{reply.title}</p>
                  <p className="text-sm text-[var(--color-muted)]">{reply.detail}</p>
                  {!isInfo ? (
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
                  ) : null}
                </div>
              ) : (
                <div className="flex h-[118px] items-center justify-center rounded-[12px] border border-dashed border-[var(--color-border)]">
                  <span className="text-xs text-[var(--color-faint)]">Reading your calendar…</span>
                </div>
              )}
            </div>
            <p className="mt-2 text-center text-xs text-[var(--color-faint)]">
              A preview - nothing's booked.{" "}
              <Link href="/sign-up" className="text-[var(--color-accent)] hover:underline">
                Sign up
              </Link>{" "}
              to use the real thing.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Compare teaser - a compact table linking to the full /vs pages.     */
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
    <section className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">How we stack up</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          The same scheduling. More for less.
        </h2>
      </Reveal>
      <Reveal className="mx-auto mt-12 max-w-4xl">
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
                <tr key={r.label} className="border-b border-[var(--color-border)] last:border-0">
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
