import { cn } from "@/lib/cn";
import type { HTMLAttributes, ReactNode } from "react";

/**
 * Surface container. Pass `interactive` on clickable cards to get the marketing
 * hover-lift (rest `shadow-card` → `shadow-raise`), so the app gains the same
 * elevation rhythm the landing page has instead of everything sitting flat.
 */
export function Card({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]",
        interactive &&
          "transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--color-text)]">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}
