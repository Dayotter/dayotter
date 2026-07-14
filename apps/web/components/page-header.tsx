import { AppReveal } from "@/components/app-reveal";
import { Eyebrow } from "@/components/section-heading";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  eyebrow,
  description,
  action,
}: {
  title: string;
  /** Mono/uppercase kicker above the title - the editorial signal from marketing. */
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <AppReveal className="mb-7 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h1 className="mt-1.5 font-display text-[2rem] leading-[1.08] tracking-[-0.02em] sm:text-[2.4rem]">
          {title}
        </h1>
        <div className="mt-3 h-px w-16 bg-gradient-to-r from-[var(--color-accent)] to-transparent" />
        {description ? (
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--color-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </AppReveal>
  );
}

export function EmptyState({
  title,
  description,
  action,
  illustration = "/brand/illustrations/otter-focus.png",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Otter illustration shown above the title; pass another /brand/illustrations/* to vary it. */
  illustration?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-strong)] px-6 py-14 text-center">
      {/* biome-ignore lint/a11y/useAltText: decorative illustration */}
      <img src={illustration} alt="" className="mb-5 h-28 w-28 object-contain" />
      <p className="font-display text-xl tracking-tight">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--color-muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
