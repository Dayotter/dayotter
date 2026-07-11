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

function StoreBadge({ logo, label }: { logo: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-[13px] border border-white/10 bg-[#0d0c11] px-4 py-2.5 text-white shadow-[var(--shadow-card)]">
      {logo}
      <div className="text-left leading-tight">
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/60">Coming soon</div>
        <div className="text-[15px] font-semibold">{label}</div>
      </div>
    </div>
  );
}

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
                  style={{ background: soft(e.hue), borderLeft: `3px solid ${HUES[e.hue]}` }}
                >
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
            Your calendar, <em className="text-[var(--color-accent)]">in your pocket.</em>
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[var(--color-muted)]">
            Native apps for iPhone and Android are on the way — the same calm scheduling, built for
            the moments you're on the move. Push reminders, one-tap booking, and your whole team's
            availability, wherever you are.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <StoreBadge logo={<AppleLogo />} label="App Store" />
            <StoreBadge logo={<PlayLogo />} label="Google Play" />
          </div>
          <p className="mt-4 text-sm text-[var(--color-faint)]">
            Available on the web today · native apps landing soon.
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
