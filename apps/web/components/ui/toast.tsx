"use client";

import { cn } from "@/lib/cn";
import { Check, Info, TriangleAlert, X } from "lucide-react";
import { type ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";

type Variant = "default" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: Variant;
}

interface ToastApi {
  toast: (t: { title: string; description?: string; variant?: Variant }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Fire a themed toast. Must be used under <ToastProvider> (mounted in the app layout). */
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

/**
 * App-wide toast host. One provider at the app root gives every client component
 * a single, consistent success/error surface - replacing the ad-hoc inline
 * "Saved" checks and silent failures scattered across the app.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback<ToastApi["toast"]>(
    (t) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts((prev) => [...prev, { id, variant: "default", ...t }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const ICON = { success: Check, error: TriangleAlert, default: Info } as const;
const TONE = {
  success: "text-[var(--color-success)]",
  error: "text-[var(--color-danger)]",
  default: "text-[var(--color-accent)]",
} as const;

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const Icon = ICON[toast.variant];
  return (
    <div className="animate-dialog-in pointer-events-auto flex items-start gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-elevated)] p-3.5 shadow-[var(--shadow-raise)]">
      <Icon size={17} className={cn("mt-0.5 shrink-0", TONE[toast.variant])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text)]">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-muted)]">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="-mr-1 -mt-1 rounded p-1 text-[var(--color-faint)] hover:text-[var(--color-text)]"
      >
        <X size={14} />
      </button>
    </div>
  );
}
