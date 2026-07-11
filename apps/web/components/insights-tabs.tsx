"use client";

import { INSIGHTS_NAV } from "@/components/nav-items";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Tab switcher between Time insights and Booking analytics (one nav item, two views). */
export function InsightsTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 inline-flex gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1">
      {INSIGHTS_NAV.map((t) => {
        const active = pathname === t.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                : "text-[var(--color-muted)] hover:text-[var(--color-text)]",
            )}
          >
            <Icon size={15} /> {t.label}
          </Link>
        );
      })}
    </div>
  );
}
