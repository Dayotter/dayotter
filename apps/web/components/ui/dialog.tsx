"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Themed modal dialog. Renders into a portal, closes on Escape / backdrop click,
 * locks body scroll, and matches the editorial system: a warm ink veil, the
 * xl radius + pop shadow, an optional eyebrow kicker, and a Fraunces serif
 * title (so modals read as part of the brand, not a generic component library).
 * Use `ConfirmDialog` for yes/no destructive prompts.
 */
export function Dialog({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Mono/uppercase kicker above the title, matching page + section headers. */
  eyebrow?: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        // Warm ink veil (matches the shadow tone) instead of flat black - softer,
        // more in-theme than the default modal scrim.
        className="absolute inset-0 cursor-default bg-[color-mix(in_srgb,var(--color-text)_42%,transparent)] backdrop-blur-[3px]"
      />
      {/* biome-ignore lint/a11y/useSemanticElements: portal-rendered modal with a custom backdrop; role=dialog is intentional */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-dialog-in relative w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-pop)]",
          className,
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-1.5 text-[var(--color-faint)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        >
          <X size={16} />
        </button>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        {title ? (
          <h2
            className={cn(
              "pr-8 font-display text-xl leading-snug tracking-[-0.01em] text-[var(--color-text)]",
              eyebrow && "mt-1.5",
            )}
          >
            {title}
          </h2>
        ) : null}
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{description}</p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** A yes/no confirmation dialog for destructive or important actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={danger ? "Confirm" : undefined}
      title={title}
      description={description}
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          size="sm"
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Working…" : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
