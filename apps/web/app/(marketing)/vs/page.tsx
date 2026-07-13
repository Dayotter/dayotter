import { MarketingHeader } from "@/components/marketing/page-shell";
import { COMPARISONS } from "@/lib/comparisons";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DayOtter vs the alternatives — honest comparisons",
  description:
    "How DayOtter compares to Calendly, Cal.com, Motion and Reclaim. Where each one wins, plainly told.",
};

export default function ComparisonsHub() {
  return (
    <>
      <MarketingHeader
        eyebrow="Compare"
        title="Honest comparisons"
        subtitle="No hand-waving. Here's where each tool wins — and where DayOtter is the better call."
      />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {COMPARISONS.map((c) => (
            <Link
              key={c.slug}
              href={`/vs/${c.slug}`}
              className="group flex flex-col rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-raise)]"
            >
              <p className="text-sm font-semibold text-[var(--color-faint)]">DayOtter vs</p>
              <h2 className="font-display mt-1 text-2xl tracking-[-0.01em]">{c.name}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                {c.blurb}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
                See the comparison{" "}
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
