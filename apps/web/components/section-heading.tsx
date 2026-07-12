import type { ReactNode } from "react";

/**
 * The mono/uppercase kicker that anchors every marketing section head. Bringing
 * it into the app (via the shared `.eyebrow` class in globals.css) is the single
 * biggest move to restore the editorial signature on logged-in pages.
 */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={className ? `eyebrow ${className}` : "eyebrow"}>{children}</span>;
}

/**
 * A consistent in-page section header (eyebrow + serif display title + optional
 * right-aligned action). Replaces the ad-hoc muted `<h2 className="text-sm">`
 * heads scattered across app pages so every section matches the marketing type
 * system (Fraunces display, tight tracking).
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-end justify-between gap-4 ${className ?? ""}`}>
      <div className="min-w-0">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-1 font-display text-xl leading-tight tracking-[-0.01em]">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
