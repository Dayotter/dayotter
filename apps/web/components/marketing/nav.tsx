"use client";

import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BRAND, MARKETING_NAV } from "@/lib/marketing";
import Link from "next/link";
import { useEffect, useState } from "react";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={34} />
          <span className="text-[15px] font-semibold tracking-tight">Day{" "}Otter</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-[var(--color-muted)] md:flex">
          {MARKETING_NAV.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="transition-colors hover:text-[var(--color-text)]"
            >
              {l.label}
            </Link>
          ))}
          <a
            href={BRAND.github}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--color-text)]"
          >
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <span className="hidden sm:inline-flex">
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
          </span>
          <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "sm" })}>
            <span className="sm:hidden">Sign up</span>
            <span className="hidden sm:inline">Get started</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
