import { MarketingHeader } from "@/components/marketing/page-shell";
import { FEATURES } from "@/lib/features";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Everything DayOtter does - AI scheduling with Otter, weighted round-robin, routing forms, focus-time protection, calendar sync, reminders, payments, and more. Open source.",
  alternates: { canonical: "/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Features"
        title="Everything you need to run your calendar"
        subtitle="From an AI assistant that does the scheduling to team round-robin, routing, and payments - all in one calm, open-source platform."
      />

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Link
              key={f.slug}
              href={`/features/${f.slug}`}
              className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-accent)]"
            >
              <p className="font-semibold text-[var(--color-text)]">{f.label}</p>
              <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {f.blurb}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]">
                Learn more{" "}
                <ArrowRight
                  size={14}
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
