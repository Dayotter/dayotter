import { ThemeToggle } from "@/components/theme-toggle";
import { BRAND } from "@/lib/marketing";
import { CalendarCheck, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: "Sync Google, Outlook & iCloud in one place" },
  { icon: Users, text: "Share availability across your whole team" },
  { icon: Sparkles, text: "AI, automations & analytics — confirm-first" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — hidden on small screens. */}
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{
          background:
            "linear-gradient(155deg, var(--color-accent) 0%, var(--color-accent-hover) 55%, #2f259c 100%)",
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            background:
              "radial-gradient(60% 50% at 100% 0%, #ffffff 0%, transparent 60%), radial-gradient(50% 40% at 0% 100%, #ffffff 0%, transparent 55%)",
          }}
        />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-white/15 text-base font-bold backdrop-blur">
              c
            </span>
            <span className="text-lg font-semibold tracking-tight">calSync</span>
          </Link>
        </div>

        <div className="relative">
          <h2 className="font-display max-w-md text-4xl leading-[1.1] tracking-[-0.01em]">
            The open-source home for your time.
          </h2>
          <p className="mt-4 max-w-sm text-white/70">
            Sync every calendar, share your availability, and let people book you — beautifully.
          </p>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.12] backdrop-blur">
                  <h.icon size={16} />
                </span>
                {h.text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/55">Made for people who value their time.</p>
      </aside>

      {/* Form panel. */}
      <div className="relative flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          {/* Logo shown on mobile (the brand panel carries it on desktop). */}
          <Link href="/" className="flex items-center gap-2 lg:invisible">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--color-accent)] text-base font-bold text-white">
              c
            </span>
            <span className="text-lg font-semibold tracking-tight">calSync</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-[var(--color-faint)]">
          <Link href="/privacy" className="hover:text-[var(--color-muted)]">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-[var(--color-muted)]">
            Terms
          </Link>
          <a
            href={BRAND.github}
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-muted)]"
          >
            Open source · Apache-2.0
          </a>
        </div>
      </div>
    </div>
  );
}
