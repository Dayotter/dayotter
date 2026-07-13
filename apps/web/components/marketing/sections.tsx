"use client";

import { BrandMark } from "@/components/brand-mark";
import { Reveal } from "@/components/marketing/motion";
import { buttonVariants } from "@/components/ui/button";
import { BRAND, FOOTER_COLUMNS } from "@/lib/marketing";
import { CalendarPlus, Check, Clock, LinkIcon, X } from "lucide-react";
import Link from "next/link";

const BEFORE = [
  "Five emails to find one time that works.",
  "Meetings creep in; the real work never gets a slot.",
  "You forget to tell your 3pm you're running late.",
  "Double-booked across three different calendars.",
  "A basic team round-robin costs $16 a seat.",
];
const AFTER = [
  "Share one link — or just ask Otter to find the time.",
  "Otter holds hours for deep work and defends them.",
  "It messages your next meeting before you even notice.",
  "Every calendar, one honest view of when you're free.",
  "Team scheduling, routing and polls — free to self-host.",
];

/** The before/after story — the calm case for switching, plainly told. */
export function Shift() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">The shift</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          From scattered to simply handled.
        </h2>
      </Reveal>
      <div className="mt-14 grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-7">
            <p className="text-sm font-semibold text-[var(--color-faint)]">Without DayOtter</p>
            <ul className="mt-5 space-y-3.5">
              {BEFORE.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-[var(--color-muted)]">
                  <X size={16} className="mt-0.5 shrink-0 text-[var(--color-faint)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="h-full rounded-[var(--radius-xl)] border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-7 shadow-[var(--shadow-raise)]">
            <p className="text-sm font-semibold text-[var(--color-accent)]">With DayOtter</p>
            <ul className="mt-5 space-y-3.5">
              {AFTER.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm text-[var(--color-text)]">
                  <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

const STEPS = [
  {
    icon: CalendarPlus,
    title: "Connect your calendars",
    body: "Link Google, Outlook or iCloud in a click. DayOtter learns when you're actually free.",
  },
  {
    icon: Clock,
    title: "Set your hours",
    body: "Draw your working hours, buffers and notice. It stays true across every timezone.",
  },
  {
    icon: LinkIcon,
    title: "Share your link",
    body: "Send one link. People pick a time that works for everyone — you get the booking.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-6xl px-6 py-24">
      <Reveal className="mx-auto max-w-2xl text-center">
        <span className="eyebrow">Live in three minutes</span>
        <h2 className="font-display mt-4 text-4xl leading-tight tracking-[-0.02em] sm:text-5xl">
          From zero to booked, fast.
        </h2>
      </Reveal>
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.1}>
            <div className="relative h-full rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]">
              <span className="font-mono text-sm text-[var(--color-faint)]">0{i + 1}</span>
              <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-[12px] bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
                <s.icon size={20} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function Manifesto() {
  return (
    <section className="mx-auto max-w-4xl px-6 py-20 text-center">
      <Reveal>
        <p className="font-display text-3xl leading-[1.3] tracking-[-0.01em] sm:text-[2.6rem]">
          We built DayOtter because your time is the one thing you can't get back.{" "}
          <em className="text-[var(--color-accent)]">
            It deserves software that treats it that way.
          </em>
        </p>
        <p className="eyebrow mt-8">The DayOtter team</p>
      </Reveal>
    </section>
  );
}

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <Reveal>
        <div
          className="grain relative overflow-hidden rounded-[28px] border border-[var(--color-border)] px-8 py-16 text-center sm:py-20"
          style={{
            background:
              "radial-gradient(60% 120% at 50% 0%, color-mix(in srgb, var(--color-accent) 22%, var(--color-surface)) 0%, var(--color-surface) 70%)",
          }}
        >
          <div className="relative z-10">
            <h2 className="font-display mx-auto max-w-2xl text-4xl leading-tight tracking-[-0.02em] sm:text-6xl">
              Take back your calendar.
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-lg text-[var(--color-muted)]">
              Free for individuals, $9/seat for teams. Up and running in minutes — on the cloud or
              your own server. Your time, your rules.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "lg" })}>
                Get started free
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight">Day{" "}Otter</span>
          </Link>
          <p className="mt-3 max-w-[240px] text-sm text-[var(--color-muted)]">{BRAND.tagline}</p>
          <div className="mt-4 flex gap-3 text-sm text-[var(--color-muted)]">
            <a
              href={BRAND.github}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[var(--color-text)]"
            >
              GitHub
            </a>
            <a
              href={BRAND.x}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-[var(--color-text)]"
            >
              X
            </a>
          </div>
        </div>
        {FOOTER_COLUMNS.map((c) => (
          <div key={c.title}>
            <p className="eyebrow">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      {l.label}
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-[var(--color-faint)] sm:flex-row">
          <span>
            © {BRAND.copyrightYear} {BRAND.name} · Apache-2.0
          </span>
          <span>Made for people who value their time.</span>
        </div>
      </div>
    </footer>
  );
}
