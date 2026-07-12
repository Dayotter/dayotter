"use client";

import { buttonVariants } from "@/components/ui/button";
import { useCallback, useEffect, useState } from "react";

const KEY = "dayotter_toured";

const STEPS = [
  {
    sel: '[data-tour="link"]',
    title: "Your booking link",
    body: "Share this and people pick a time you're free — no back-and-forth.",
  },
  {
    sel: '[data-tour="hours"]',
    title: "Set your hours",
    body: "Tell DayOtter when you're open, so it only ever offers times that work for you.",
  },
  {
    sel: '[data-tour="types"]',
    title: "Create a booking type",
    body: "Set up the meetings people can book — a 30-min intro, office hours, whatever you need.",
  },
];

/** First-visit coachmark tour of the dashboard. Runs once (localStorage flag). */
export function DashboardTour() {
  const [step, setStep] = useState(-1);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const end = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setStep(STEPS.length);
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setStep(0), 700);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (step < 0 || step >= STEPS.length) return;
    const el = document.querySelector<HTMLElement>(STEPS[step]!.sel);
    const r = el?.getBoundingClientRect();
    // Skip targets that are absent or hidden (e.g. the sidebar on mobile).
    if (!el || !r || r.width === 0 || r.height === 0) {
      setStep((s) => s + 1);
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const id = window.setInterval(measure, 150);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  if (step < 0 || step >= STEPS.length || !rect) return null;
  const s = STEPS[step]!;
  const below = rect.bottom + 190 < window.innerHeight;
  const tipTop = below ? rect.bottom + 12 : rect.top - 12;
  const tipLeft = Math.min(Math.max(rect.left, 16), window.innerWidth - 316);

  return (
    <div className="fixed inset-0 z-[200]">
      <div
        className="pointer-events-none absolute rounded-lg transition-all duration-300"
        style={{
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          boxShadow: "0 0 0 9999px rgba(11,10,16,0.55)",
        }}
      />
      <div
        className="absolute w-[300px] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-float)]"
        style={{ top: tipTop, left: tipLeft, transform: below ? undefined : "translateY(-100%)" }}
      >
        <p className="font-display text-lg tracking-tight">{s.title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[var(--color-faint)]">
            {step + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={end}
              className="text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => (step >= STEPS.length - 1 ? end() : setStep(step + 1))}
              className={buttonVariants({ variant: "primary", size: "sm" })}
            >
              {step >= STEPS.length - 1 ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
