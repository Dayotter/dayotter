import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 opacity-[0.14]"
        style={{
          background: "radial-gradient(50% 60% at 50% 0%, var(--color-accent) 0%, transparent 65%)",
        }}
      />
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>
      <Link href="/" className="relative mb-8 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--color-accent)] text-base font-bold text-white">
          c
        </span>
        <span className="text-lg font-semibold tracking-tight">calSync</span>
      </Link>
      <div className="relative w-full max-w-sm">{children}</div>
      <p className="relative mt-8 text-xs text-[var(--color-faint)]">
        Open-source scheduling · Apache-2.0
      </p>
    </div>
  );
}
