import { cn } from "@/lib/cn";

/** A pulsing placeholder for content that's still loading. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-[var(--color-surface-2)]", className)}
    />
  );
}

/** A few stacked rows — a ready-made skeleton for list/agenda loading states. */
export function SkeletonRows({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-4 py-3"
        >
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
