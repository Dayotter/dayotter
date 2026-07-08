import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

/** Submit-level error banner — themed, with an icon and role="alert" for a11y. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-[var(--color-danger)]/25 bg-[var(--color-danger-soft)] px-3 py-2.5 text-sm text-[var(--color-danger)]"
    >
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Submit-level success banner. */
export function FormSuccess({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-success)]/25 bg-[var(--color-success)]/10 px-3 py-2.5 text-sm text-[var(--color-success)]">
      <CheckCircle2 size={15} className="shrink-0" />
      <span>{children}</span>
    </div>
  );
}

/** Inline, per-field validation message shown under an input. */
export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="mt-1 text-xs text-[var(--color-danger)]">{children}</p>;
}
