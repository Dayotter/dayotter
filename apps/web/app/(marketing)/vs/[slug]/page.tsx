import { MarketingHeader } from "@/components/marketing/page-shell";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { COMPARISONS, getComparison } from "@/lib/comparisons";
import { Check, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const c = getComparison((await params).slug);
  if (!c) return { title: "Compare - DayOtter" };
  const path = `/vs/${c.slug}`;
  const title = `${c.title} (2026) - how they compare`;
  return {
    title,
    description: c.subtitle,
    alternates: { canonical: path },
    openGraph: { title, description: c.subtitle, url: path },
  };
}

const EDGE_STYLES = {
  us: "text-[var(--color-accent)]",
  them: "text-[var(--color-muted)]",
  tie: "text-[var(--color-text)]",
} as const;

export default async function ComparisonPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = getComparison((await params).slug);
  if (!c) notFound();

  return (
    <>
      <FaqJsonLd items={c.faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "Compare", path: "/vs" },
          { name: c.name, path: `/vs/${c.slug}` },
        ]}
      />
      <MarketingHeader eyebrow="Compare" title={c.title} subtitle={c.subtitle} />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="space-y-4 text-[15px] leading-7 text-[var(--color-muted)]">
          {c.intro.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
          <p className="text-sm font-semibold text-[var(--color-text)]">What {c.name} does well</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
            {c.theirStrength}
          </p>
        </div>

        {/* Comparison table */}
        <div className="mt-12 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="bg-[var(--color-surface-2)] text-left">
                <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">&nbsp;</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-accent)]">DayOtter</th>
                <th className="px-4 py-3 font-semibold text-[var(--color-muted)]">{c.name}</th>
              </tr>
            </thead>
            <tbody>
              {c.rows.map((r) => (
                <tr key={r.label} className="border-t border-[var(--color-border)]">
                  <td className="px-4 py-3 font-medium text-[var(--color-text)]">{r.label}</td>
                  <td className={`px-4 py-3 ${EDGE_STYLES[r.edge ?? "tie"]}`}>{r.dayotter}</td>
                  <td className="px-4 py-3 text-[var(--color-muted)]">{r.them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Why DayOtter */}
        <h2 className="font-display mt-14 text-2xl tracking-[-0.01em] text-[var(--color-text)]">
          Why teams pick DayOtter
        </h2>
        <div className="mt-5 space-y-4">
          {c.whyUs.map((w) => (
            <div key={w.title} className="flex gap-3">
              <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">{w.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{w.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Verdict */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
              <Minus size={15} /> Choose {c.name} if
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{c.chooseThem}</p>
          </div>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-5 shadow-[var(--shadow-raise)]">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--color-accent)]">
              <Check size={15} /> Choose DayOtter if
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{c.chooseUs}</p>
          </div>
        </div>

        {/* FAQ */}
        <h2 className="font-display mt-14 text-2xl tracking-[-0.01em] text-[var(--color-text)]">
          Questions
        </h2>
        <div className="mt-5 divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {c.faq.map((f) => (
            <div key={f.q} className="py-5">
              <p className="font-semibold text-[var(--color-text)]">{f.q}</p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{f.a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
            Try DayOtter free
          </Link>
          <Link href="/vs" className={buttonVariants({ variant: "outline" })}>
            All comparisons
          </Link>
        </div>
      </div>
    </>
  );
}
