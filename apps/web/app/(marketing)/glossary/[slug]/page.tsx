import { MarketingHeader } from "@/components/marketing/page-shell";
import { BreadcrumbJsonLd, DefinedTermJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { GLOSSARY, getGlossaryTerm } from "@/lib/glossary";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return GLOSSARY.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const t = getGlossaryTerm((await params).slug);
  if (!t) return { title: "Glossary" };
  const path = `/glossary/${t.slug}`;
  const title = `${t.term} - scheduling glossary`;
  return {
    title,
    description: t.short,
    alternates: { canonical: path },
    openGraph: { title, description: t.short, url: path },
  };
}

export default async function GlossaryTermPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = getGlossaryTerm(slug);
  if (!t) notFound();

  const related = t.related
    .map((s) => getGlossaryTerm(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <>
      <DefinedTermJsonLd term={t.term} definition={t.short} path={`/glossary/${t.slug}`} />
      <BreadcrumbJsonLd
        items={[
          { name: "Glossary", path: "/glossary" },
          { name: t.term, path: `/glossary/${t.slug}` },
        ]}
      />
      <MarketingHeader eyebrow={t.category} title={t.term} subtitle={t.short} />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <section className="space-y-4 text-[15px] leading-7 text-[var(--color-muted)]">
          {t.body.map((p) => (
            <p key={p.slice(0, 24)}>{p}</p>
          ))}
        </section>

        <section className="mt-10 rounded-[var(--radius-lg)] border border-[var(--color-accent)]/40 bg-[var(--color-surface)] p-5 shadow-[var(--shadow-raise)]">
          <p className="text-sm font-semibold text-[var(--color-accent)]">In DayOtter</p>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">{t.inDayOtter}</p>
        </section>

        {t.seeAlso && t.seeAlso.length > 0 ? (
          <section className="mt-8">
            <p className="eyebrow mb-3">See also</p>
            <div className="flex flex-wrap gap-2.5">
              {t.seeAlso.map((s) => (
                <Link
                  key={s.href}
                  href={s.href}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  {s.label} <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-12 flex flex-wrap items-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
            Try DayOtter free
          </Link>
          <Link href="/glossary" className={buttonVariants({ variant: "outline" })}>
            All terms
          </Link>
        </section>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-[var(--color-border)] pt-10">
            <p className="eyebrow text-center">Related terms</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/glossary/${r.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  {r.term} <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
