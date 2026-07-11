"use client";

import { BrandMark } from "@/components/brand-mark";
import { NAV } from "@/components/nav-items";
import { ThemeToggle } from "@/components/theme-toggle";
import { signOut } from "@/lib/auth/auth-client";
import { cn } from "@/lib/cn";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/** Mobile chrome: a fixed top bar + a bottom tab bar. Hidden on lg+ (sidebar takes over). */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <>
      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)]/85 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandMark size={34} />
          <span className="text-[15px] font-semibold tracking-tight">Day{" "}Otter</span>
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

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.map(({ href, short, icon: Icon }) => {
          const section = (p: string) => `/${p.split("/")[1] ?? ""}`;
          const active = section(pathname) === section(href);
          return (
            <Link
              key={href}
              href={href}
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
      </nav>
    </>
  );
}
