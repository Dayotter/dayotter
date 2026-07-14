"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const SLIDES = [
  {
    img: "/brand/illustrations/otter-plan.png",
    title: "Welcome to DayOtter",
    body: "The calm home for your time - scheduling that respects every calendar you own.",
  },
  {
    img: "/brand/illustrations/otter-agenda.png",
    title: "Share one link",
    body: "People pick a time you're actually free. No back-and-forth, no double-booking.",
  },
  {
    img: "/brand/illustrations/otter-relax.png",
    title: "Protect your calm",
    body: "Buffers, focus blocks, and gentle reminders keep your day yours - not your calendar's.",
  },
  {
    img: "/brand/illustrations/otter-remind.png",
    title: "Never miss a beat",
    body: "Automatic reminders and your whole team's free time, together in one place.",
  },
];

export default function WelcomePage() {
  const [i, setI] = useState(0);
  const slide = SLIDES[i]!;
  const last = i === SLIDES.length - 1;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-6 py-10">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center text-center">
        {/* biome-ignore lint/a11y/useAltText: decorative illustration */}
        <img src={slide.img} alt="" className="mb-9 h-60 w-60 object-contain sm:h-64 sm:w-64" />
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{slide.title}</h1>
        <p className="mt-3 max-w-sm leading-relaxed text-[var(--color-muted)]">{slide.body}</p>
      </div>

      <div className="w-full max-w-md">
        <div className="mb-7 flex justify-center gap-2">
          {SLIDES.map((s, idx) => (
            <span
              key={s.title}
              className={cn(
                "h-1.5 rounded-full transition-all",
                idx === i
                  ? "w-5 bg-[var(--color-accent)]"
                  : "w-1.5 bg-[var(--color-border-strong)]",
              )}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {i > 0 ? (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Back
            </button>
          ) : null}
          {last ? (
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "flex-1")}
            >
              Get started <ArrowRight size={17} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setI(i + 1)}
              className={cn(buttonVariants({ variant: "primary", size: "lg" }), "flex-1")}
            >
              Next <ArrowRight size={17} />
            </button>
          )}
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/dashboard"
            className="text-sm text-[var(--color-faint)] transition-colors hover:text-[var(--color-muted)]"
          >
            Skip
          </Link>
        </div>
      </div>
    </main>
  );
}
