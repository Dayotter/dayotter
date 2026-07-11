"use client";

import { BrandMark } from "@/components/brand-mark";
import { NAV } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/auth-client";
import { cn } from "@/lib/cn";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AppNav({ user }: { user: { name?: string | null; email: string } }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] p-3 lg:flex">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3">
        <BrandMark size={28} />
        <span className="text-[15px] font-semibold tracking-tight">dayotter</span>
      </Link>

      <nav className="mt-3 flex flex-1 flex-col gap-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          // Match by top-level section so sub-pages (e.g. /settings/preferences,
          // /event-types/[id]/edit) keep their parent item highlighted.
          const section = (p: string) => `/${p.split("/")[1] ?? ""}`;
          const active = section(pathname) === section(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-[var(--color-accent-soft)] font-medium text-[var(--color-accent)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]",
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
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
