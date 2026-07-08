import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

const tones = {
  success: "bg-[var(--color-success)]/15 text-[var(--color-success)]",
  danger: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
  warning: "bg-[var(--color-amber)]/15 text-[var(--color-amber)]",
  accent: "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
} as const;

export type BadgeTone = keyof typeof tones;

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Map a booking status to a badge tone. */
export function statusTone(status: string): BadgeTone {
  if (status === "confirmed") return "success";
  if (status === "cancelled" || status === "rejected") return "danger";
  if (status === "pending") return "warning";
  return "neutral";
}
