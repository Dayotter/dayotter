import { MarketingHeader } from "@/components/marketing/page-shell";
import { GLOSSARY, GLOSSARY_CATEGORIES } from "@/lib/glossary";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Scheduling glossary",
  description:
    "Plain-English definitions of scheduling terms - round-robin, collective availability, routing forms, buffer time, free/busy, focus time, confirm-first AI and more.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryHub() {
  return (
    <>
      <MarketingHeader
        eyebrow="Glossary"
        title="The scheduling glossary"
        subtitle="Every term you'll meet in modern scheduling, defined plainly - and how DayOtter does each one."
      />
      <section className="mx-auto max-w-5xl px-6 py-16">
        {GLOSSARY_CATEGORIES.map((cat) => {
          const terms = GLOSSARY.filter((t) => t.category === cat);
          if (terms.length === 0) return null;
          return (
            <div key={cat} className="mb-12">
              <p className="eyebrow mb-5">{cat}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {terms.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/glossary/${t.slug}`}
                    className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-accent)]"
                  >
                    <p className="font-semibold text-[var(--color-text)]">{t.term}</p>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                      {t.short}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]">
                      Read{" "}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
