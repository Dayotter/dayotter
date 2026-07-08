import { cn } from "@/lib/cn";
import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

/** Design-system select — matches Input's height, radius, border, and focus ring. */
export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] pl-3 pr-9 text-sm text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-faint)]"
      />
    </div>
  );
}
