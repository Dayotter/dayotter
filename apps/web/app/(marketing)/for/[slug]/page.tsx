import { MarketingHeader } from "@/components/marketing/page-shell";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { makeSlugMetadata } from "@/lib/marketing-page";
import { PERSONAS, getPersona } from "@/lib/personas";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ slug: p.slug }));
}

export const generateMetadata = makeSlugMetadata(
  getPersona,
  (p) => ({ title: p.title, description: p.subtitle, path: `/for/${p.slug}` }),
  "DayOtter",
);

export default async function PersonaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getPersona(slug);
  if (!p) notFound();
  const others = PERSONAS.filter((x) => x.slug !== slug);

  return (
    <>
      <FaqJsonLd items={p.faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "For", path: "/for" },
          { name: p.label, path: `/for/${p.slug}` },
        ]}
      />
      <MarketingHeader
        eyebrow={`For ${p.label.toLowerCase()}`}
        title={p.title}
        subtitle={p.subtitle}
      />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-14 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
            Get started free
          </Link>
          <Link href="/#how" className={buttonVariants({ variant: "outline" })}>
            See how it works
          </Link>
        </div>

        {/* The problem */}
        <section>
          <h2 className="font-display text-center text-3xl tracking-[-0.01em]">Sound familiar?</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {p.problems.map((pr) => (
              <div
                key={pr.title}
                className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5"
              >
                <p className="font-semibold text-[var(--color-text)]">{pr.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{pr.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* The fit */}
        <section className="mt-20">
          <h2 className="font-display text-center text-3xl tracking-[-0.01em]">
            How DayOtter fits
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {p.solutions.map((s) => (
              <div
                key={s.title}
                className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
              >
                <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                <div>
                  <p className="font-semibold text-[var(--color-text)]">{s.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-20">
          <h2 className="font-display text-center text-3xl tracking-[-0.01em]">
            Up and running in minutes
          </h2>
          <ol className="mx-auto mt-8 max-w-xl space-y-4">
            {p.steps.map((step, i) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] font-mono text-sm font-semibold text-[var(--color-accent)]">
                  {i + 1}
                </span>
                <p className="pt-1 text-[15px] text-[var(--color-muted)]">{step}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-2xl">
          <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
            {p.faq.map((f) => (
              <div key={f.q} className="py-5">
                <p className="font-semibold text-[var(--color-text)]">{f.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16 text-center">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Start free - no credit card
          </Link>
        </section>

        {/* Cross-links */}
        <section className="mt-20 border-t border-[var(--color-border)] pt-10">
          <p className="eyebrow text-center">DayOtter for</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/for/${o.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {o.label} <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
