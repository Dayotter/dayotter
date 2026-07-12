"use client";

import { BrandMark } from "@/components/brand-mark";
import { NAV } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/auth-client";
import { cn } from "@/lib/cn";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// Editorial grouping of the flat NAV list — gives the rail eyebrow-labelled
// sections (like the marketing section heads) instead of one flat list.
const GROUPS: { label: string; items: string[] }[] = [
  { label: "Workspace", items: ["/dashboard", "/event-types", "/availability", "/bookings"] },
  { label: "Insights", items: ["/inbox", "/teams", "/insights"] },
  { label: "Account", items: ["/settings/profile"] },
];

// Match by top-level section so sub-pages (e.g. /settings/preferences,
// /event-types/[id]/edit) keep their parent item highlighted.
const section = (p: string) => `/${p.split("/")[1] ?? ""}`;

export function AppNav({ user }: { user: { name?: string | null; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3">
        <BrandMark size={34} />
        <span className="font-display text-[17px] tracking-[-0.01em]">DayOtter</span>
      </Link>

      <nav className="mt-4 flex flex-1 flex-col gap-5">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            <span className="eyebrow px-3 pb-1.5">{group.label}</span>
            {group.items.map((href) => {
              const item = NAV.find((n) => n.href === href);
              if (!item) return null;
              const Icon = item.icon;
              const active = section(pathname) === section(item.href);
              return (
                <Link
                  key={href}
                  href={item.href}
                  data-tour={
                    item.href === "/availability"
                      ? "hours"
                      : item.href === "/event-types"
                        ? "types"
                        : undefined
                  }
                  className={cn(
                    "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]"
                      : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--color-accent)]" />
                  ) : null}
                  <Icon size={17} strokeWidth={active ? 2.4 : 2} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-2 flex justify-center pb-2">
        <ThemeToggle />
      </div>

      <div className="border-t border-[var(--color-border)] pt-3">
        <div className="flex items-center gap-3 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-sm font-semibold text-white">
            {(user.name ?? user.email).charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.name ?? "You"}</p>
            <p className="truncate text-xs text-[var(--color-muted)]">{user.email}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => signOut().then(() => router.push("/sign-in"))}
            className="rounded-md p-1.5 text-[var(--color-faint)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
