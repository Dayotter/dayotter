"use client";

import { AiAssistant } from "@/components/ai-assistant";
import { OtterVoice } from "@/components/otter-voice";
import type { Locale } from "@/lib/i18n";
import { tOtter } from "@/lib/i18n/otter";
import { useAppLocale } from "@/lib/i18n/use-locale";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Mode = "voice" | "chat";

/**
 * The primary way to reach Otter - a floating otter button on every app page
 * that opens the assistant in a slide-over (right drawer on desktop, bottom
 * sheet on mobile). Opens in hands-free voice mode by default; a tap switches to
 * text chat. Rendered globally from the app layout, gated on `aiEnabled`.
 */
export function OtterLauncher() {
  const locale = useAppLocale();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {open ? null : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={tOtter(locale, "askOtter")}
          className="group fixed bottom-24 right-4 z-40 flex items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1.5 pl-1.5 pr-2.5 shadow-[var(--shadow-raise)] transition-transform hover:-translate-y-0.5 lg:bottom-6 lg:right-6"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2 ring-[var(--color-accent)]">
            {/* biome-ignore lint/a11y/useAltText: decorative otter avatar */}
            <img
              src="/brand/illustrations/otter-focus.png"
              alt=""
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 animate-ping rounded-full ring-2 ring-[var(--color-accent)] opacity-20" />
          </span>
          <span className="pr-1 text-sm font-medium text-[var(--color-text)]">
            {tOtter(locale, "askOtter")}
          </span>
        </button>
      )}

      {open ? <Portal>{drawer(() => setOpen(false), mode, setMode, locale)}</Portal> : null}
    </>
  );
}

function drawer(
  onClose: () => void,
  mode: Mode,
  setMode: (m: Mode) => void,
  locale: Locale,
): ReactNode {
  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label={tOtter(locale, "closeAssistant")}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[color-mix(in_srgb,var(--color-text)_38%,transparent)] backdrop-blur-[2px]"
      />
      <div className="animate-dialog-in absolute inset-x-0 bottom-0 flex h-[85vh] flex-col overflow-hidden rounded-t-[var(--radius-xl)] border-t border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[440px] sm:rounded-none sm:border-l sm:border-t-0">
        {mode === "voice" ? (
          <OtterVoice onSwitchToChat={() => setMode("chat")} onClose={onClose} />
        ) : (
          <AiAssistant variant="panel" onClose={onClose} onSwitchToVoice={() => setMode("voice")} />
        )}
      </div>
    </div>
  );
}

function Portal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
