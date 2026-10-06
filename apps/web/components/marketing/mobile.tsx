"use client";

import { BrandMark } from "@/components/brand-mark";
import { Float, Reveal } from "@/components/marketing/motion";
import { CalendarClock, CalendarDays, LayoutDashboard, Settings, Users } from "lucide-react";

const HUES = {
  violet: "var(--color-accent)",
  mint: "var(--color-mint)",
  amber: "var(--color-amber)",
  coral: "var(--color-coral)",
} as const;
type Hue = keyof typeof HUES;

function soft(hue: Hue) {
  return `color-mix(in srgb, ${HUES[hue]} 15%, var(--color-surface))`;
}

function AppleLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 384 512" width={size} height={size} fill="currentColor" aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}

function PlayLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M3 2.5v19l11-9.5z" fill="#34d399" />
      <path d="M3 2.5l11 9.5 3.2-2.8z" fill="#60a5fa" />
      <path d="M3 21.5l11-9.5 3.2 2.8z" fill="#f0654e" />
      <path d="M14 12l3.2-2.8 3.6 2-.02.02c.7.4.7 1.16.02 1.56L17.2 14.8z" fill="#f0ad4e" />
    </svg>
  );
}

function StoreBadge({
  logo,
  label,
  href,
}: {
  logo: React.ReactNode;
  label: string;
  /** When set, the badge is a live download link; otherwise it reads "Coming soon". */
  href?: string;
}) {
  const cls =
    "inline-flex items-center gap-3 rounded-[13px] border border-white/10 bg-[#0d0c11] px-4 py-2.5 text-white shadow-[var(--shadow-card)]";
  const inner = (
    <>
      {logo}
      <div className="text-left leading-tight">
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/60">
          {href ? "Get it on" : "Coming soon"}
        </div>
        <div className="text-[15px] font-semibold">{label}</div>
      </div>
    </>
  );
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Get DayOtter on ${label}`}
      className={`${cls} transition-transform hover:-translate-y-0.5`}
    >
      {inner}
    </a>
  ) : (
    <div className={`${cls} opacity-80`} aria-label={`${label} - coming soon`}>
      {inner}
    </div>
  );
}

// Plain-language value, not a feature list: what you actually get to do from
// your phone, written the way someone deciding on the product would read it.
const ON_YOUR_PHONE = [
  "Your day and next booking the moment you open it",
  "Change how people book you and set your hours anywhere",
  "Push reminders, plus book and move things by talking to Otter",
];

const AGENDA = [
  { time: "9:30", title: "Standup", hue: "violet" as Hue, who: "Team" },
  { time: "11:00", title: "Intro call · Dana", hue: "mint" as Hue, who: "Google Meet" },
  { time: "2:00", title: "Design review", hue: "amber" as Hue, who: "3 people" },
  { time: "4:30", title: "Focus block", hue: "coral" as Hue, who: "Do not disturb" },
];

// Mirrors the real app's tab bar: Home · Events · Teams · Bookings · Settings.
const TABS = [
  { icon: LayoutDashboard, active: true },
  { icon: CalendarClock, active: false },
  { icon: Users, active: false },
  { icon: CalendarDays, active: false },
  { icon: Settings, active: false },
];

/** A phone-framed mockup of the DayOtter mobile app. */
function PhoneMock() {
  return (
    <div className="relative mx-auto w-[264px]">
      <div className="rounded-[46px] border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] p-2.5 shadow-[var(--shadow-float)]">
        <div className="relative overflow-hidden rounded-[38px] border border-[var(--color-border)] bg-[var(--color-bg)]">
          {/* Dynamic island */}
          <div className="absolute left-1/2 top-2.5 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0d0c11]" />

          <div className="px-4 pb-3 pt-11">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrandMark size={26} />
                <div>
                  <p className="font-display text-lg leading-none">Day{" "}Otter</p>
                  <p className="mt-1 text-[11px] text-[var(--color-muted)]">Thursday, Jul 3</p>
                </div>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-semibold text-white">
                A
              </div>
            </div>

            {/* Agenda */}
            <div className="mt-4 space-y-2">
              {AGENDA.map((e) => (
                <div
                  key={e.title}
                  className="flex items-center gap-3 rounded-[12px] px-3 py-2.5"
                  style={{ background: soft(e.hue) }}
                >
                  {/* The rounded colour bar the real agenda uses, not a stripe
                      down the side - so the mock depicts the shipped pattern. */}
                  <span
                    aria-hidden
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: HUES[e.hue] }}
                  />
                  <div className="w-9 shrink-0 text-[11px] font-medium text-[var(--color-muted)]">
                    {e.time}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{e.title}</p>
                    <p className="truncate text-[11px] text-[var(--color-muted)]">{e.who}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom tab bar */}
          <div className="flex items-center justify-around border-t border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-3">
            {TABS.map((t, i) => (
              <t.icon
                key={i}
                size={19}
                className={t.active ? "text-[var(--color-accent)]" : "text-[var(--color-faint)]"}
                strokeWidth={t.active ? 2.4 : 2}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileApps() {
  return (
    <section id="mobile" className="relative overflow-hidden scroll-mt-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(50% 60% at 78% 40%, color-mix(in srgb, var(--color-accent) 14%, transparent) 0%, transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
        <Reveal>
          <span className="eyebrow">iOS &amp; Android</span>
          <h2 className="font-display mt-4 text-4xl leading-[1.08] tracking-[-0.02em] sm:text-5xl">
            Run your scheduling <em className="text-[var(--color-accent)]">from your phone.</em>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-muted)]">
            Open the app and your day is right there - what's booked, what's next, and anything
            waiting on you. Set up how people book you, adjust your hours, handle your team, and
            hand the busywork to Otter by voice. It does the real work, not just a read-only glance
            at your calendar.
          </p>
          <ul className="mt-6 flex max-w-md flex-col gap-2.5">
            {ON_YOUR_PHONE.map((c) => (
              <li
                key={c}
                className="flex items-start gap-2.5 text-[15px] text-[var(--color-muted)]"
              >
                <span
                  aria-hidden
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-accent)]"
                />
                {c}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <StoreBadge
              logo={<PlayLogo />}
              label="Google Play"
              href="https://play.google.com/store/apps/details?id=com.dayotter.app"
            />
            <StoreBadge logo={<AppleLogo />} label="App Store" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-faint)]">
            On the web and Android today · iOS landing soon.
          </p>
        </Reveal>

        <Reveal delay={0.15}>
          <Float>
            <PhoneMock />
          </Float>
        </Reveal>
      </div>
    </section>
  );
}
