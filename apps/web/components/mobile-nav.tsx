"use client";

import { BrandMark } from "@/components/brand-mark";
import { NAV } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/auth-client";
import { cn } from "@/lib/cn";
import { LogOut, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

// Four primary tabs stay on the bar; the rest live behind a "More" sheet so the
// bar never crams 8 items into a phone width.
const PRIMARY = NAV.slice(0, 4);
const MORE = NAV.slice(4);

const section = (p: string) => `/${p.split("/")[1] ?? ""}`;

/** Mobile chrome: a fixed top bar + a bottom tab bar. Hidden on lg+ (sidebar takes over). */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) => section(pathname) === section(href);
  const moreActive = MORE.some((i) => isActive(i.href));

  return (
    <>
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandMark size={34} />
          <span className="font-display text-[17px] tracking-[-0.01em]">DayOtter</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => signOut().then(() => router.push("/sign-in"))}
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* "More" sheet */}
      {moreOpen ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--color-text)_35%,transparent)] backdrop-blur-[2px] lg:hidden"
          />
          <div className="fixed inset-x-0 bottom-16 z-40 rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-surface)] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[var(--shadow-pop)] lg:hidden">
            <span className="eyebrow px-1">More</span>
            <div className="mt-3 grid grid-cols-4 gap-1">
              {MORE.map(({ href, short, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-md py-3 text-[11px] font-medium transition-colors",
                    isActive(href)
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]",
                  )}
                >
                  <Icon size={20} strokeWidth={isActive(href) ? 2.4 : 2} />
                  {short}
                </Link>
              ))}
            </div>
          </div>
        </>
      ) : null}

      {/* Bottom tab bar: 4 primary + More */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {PRIMARY.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-[var(--color-accent)]" : "text-[var(--color-faint)]",
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {short}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More"
          aria-expanded={moreOpen}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
            moreActive || moreOpen ? "text-[var(--color-accent)]" : "text-[var(--color-faint)]",
          )}
        >
          <MoreHorizontal size={20} strokeWidth={moreActive || moreOpen ? 2.4 : 2} />
          More
        </button>
      </nav>
    </>
  );
}
