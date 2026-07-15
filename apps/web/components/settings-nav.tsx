"use client";

import { SETTINGS_NAV } from "@/components/nav-items";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Settings sub-nav - a scrollable underline tab strip on mobile, a vertical
 * pill rail on large screens (so the settings pane fills the width instead of
 * stranding a narrow column against the left edge).
 */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)] lg:sticky lg:top-8 lg:mb-0 lg:max-h-[calc(100dvh-4rem)] lg:flex-col lg:gap-0.5 lg:self-start lg:overflow-visible lg:border-b-0 lg:pt-1">
      {SETTINGS_NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 border-transparent px-3 py-2.5 text-sm transition-colors lg:rounded-md lg:border-b-0 lg:py-2",
              active
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text)] lg:bg-[var(--color-accent-soft)] lg:text-[var(--color-accent)]"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)] lg:hover:bg-[var(--color-surface-2)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
