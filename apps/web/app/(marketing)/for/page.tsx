import { MarketingHeader } from "@/components/marketing/page-shell";
import { PERSONAS } from "@/lib/personas";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Who DayOtter is for",
  description:
    "How DayOtter fits founders, teams, sales, agencies, consultants, recruiters, customer success, tutors, freelancers, support teams and busy minds - scheduling shaped around how you actually work.",
  alternates: { canonical: "/for" },
};

export default function ForHub() {
  return (
    <>
      <MarketingHeader
        eyebrow="For you"
        title="Scheduling, shaped around how you work"
        subtitle="Same calm platform, tuned to your world. Find the version of DayOtter that fits what your days actually look like."
      />
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <Link
              key={p.slug}
              href={`/for/${p.slug}`}
              className="group flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-raise)]"
            >
              <p className="text-sm font-semibold text-[var(--color-faint)]">DayOtter for</p>
              <h2 className="font-display mt-1 text-2xl tracking-[-0.01em]">{p.label}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {p.subtitle}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
                See how it fits{" "}
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
