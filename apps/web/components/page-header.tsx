import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div>
        <h1 className="font-display text-2xl tracking-tight sm:text-[1.7rem]">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
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
