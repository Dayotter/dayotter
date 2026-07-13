"use client";

import { BookingMock, CalendarMock, ReminderMock } from "@/components/marketing/mocks";
import { FadeUp, Float } from "@/components/marketing/motion";
import { buttonVariants } from "@/components/ui/button";
import { BRAND } from "@/lib/marketing";
import { motion } from "framer-motion";
import { ArrowRight, Smartphone, Star } from "lucide-react";
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-[640px]"
        style={{
          background:
            "radial-gradient(48% 42% at 50% 8%, color-mix(in srgb, var(--color-accent) 22%, transparent) 0%, transparent 62%), radial-gradient(40% 40% at 82% 20%, color-mix(in srgb, var(--color-coral) 14%, transparent) 0%, transparent 60%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl px-6 pt-16 text-center sm:pt-24">
        <FadeUp>
          <span className="eyebrow">Scheduling, minus the back-and-forth</span>
        </FadeUp>
        <FadeUp delay={0.08}>
          <h1 className="font-display mx-auto mt-5 max-w-4xl text-[2.6rem] leading-[1.04] tracking-[-0.02em] sm:text-6xl lg:text-[4.5rem]">
            Scheduling that respects <em className="text-[var(--color-accent)]">every calendar</em>{" "}
            you own.
          </h1>
        </FadeUp>
        <FadeUp delay={0.16}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--color-muted)]">
            One calm home for your time — sync every calendar, share availability across your team,
            and let people book you. Beautifully. Self-hostable, or use the cloud.
          </p>
        </FadeUp>
        <FadeUp delay={0.24}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "lg" })}>
              Get started free <ArrowRight size={17} />
            </Link>
            <a
              href={BRAND.github}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              <Star size={16} /> Star on GitHub
            </a>
          </div>
        </FadeUp>
        <FadeUp delay={0.32}>
          <p className="mt-6 text-sm text-[var(--color-faint)]">
            Free forever for individuals · No credit card
          </p>
        </FadeUp>
        <FadeUp delay={0.38}>
          <a
            href="#mobile"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/60 px-3.5 py-1.5 text-sm text-[var(--color-muted)] backdrop-blur transition-colors hover:text-[var(--color-text)]"
          >
            <Smartphone size={14} className="text-[var(--color-accent)]" />
            On the web today — iOS &amp; Android on the way
            <ArrowRight size={13} />
          </a>
        </FadeUp>
      </div>

      {/* Product showcase */}
      <div className="relative mx-auto mt-16 max-w-4xl px-6 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
        >
          <CalendarMock />
        </motion.div>

        {/* Floating overlays */}
        <Float className="absolute -bottom-6 -left-2 z-10 w-56 sm:-left-10 sm:w-64">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
          >
            <BookingMock />
          </motion.div>
        </Float>
        <Float className="absolute -right-2 top-24 z-10 hidden w-72 sm:-right-8 md:block">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1 }}
          >
            <ReminderMock />
          </motion.div>
        </Float>
      </div>
    </section>
  );
}
