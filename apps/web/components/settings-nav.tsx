"use client";

import { SETTINGS_NAV } from "@/components/nav-items";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Horizontal tab strip for the Settings area. */
export function SettingsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
      {SETTINGS_NAV.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors",
              active
                ? "border-[var(--color-accent)] font-medium text-[var(--color-text)]"
                : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]",
            )}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
