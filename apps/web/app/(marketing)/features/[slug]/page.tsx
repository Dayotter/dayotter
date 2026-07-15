import { MarketingHeader } from "@/components/marketing/page-shell";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { FEATURES, getFeature } from "@/lib/features";
import { makeSlugMetadata } from "@/lib/marketing-page";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export const generateMetadata = makeSlugMetadata(
  getFeature,
  (f) => ({ title: f.title, description: f.subtitle, path: `/features/${f.slug}` }),
  "Features",
);

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = getFeature(slug);
  if (!f) notFound();
  const related = f.related.map(getFeature).filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <>
      <FaqJsonLd items={f.faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "Features", path: "/features" },
          { name: f.label, path: `/features/${f.slug}` },
        ]}
      />
      <MarketingHeader eyebrow="Feature" title={f.title} subtitle={f.subtitle} />

      <div className="mx-auto max-w-4xl px-6 py-16">
        <div className="mb-14 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
            Get started free
          </Link>
          <Link href="/#how" className={buttonVariants({ variant: "outline" })}>
            See how it works
          </Link>
        </div>

        <section className="mx-auto max-w-2xl space-y-4">
          {f.intro.map((p) => (
            <p
              key={p.slice(0, 24)}
              className="text-[15px] leading-relaxed text-[var(--color-muted)]"
            >
              {p}
            </p>
          ))}
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {f.points.map((pt) => (
            <div
              key={pt.title}
              className="flex gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]"
            >
              <Check size={18} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
              <div>
                <p className="font-semibold text-[var(--color-text)]">{pt.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--color-muted)]">{pt.body}</p>
              </div>
            </div>
          ))}
        </section>

        {f.faq.length > 0 ? (
          <section className="mx-auto mt-20 max-w-2xl">
            <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {f.faq.map((q) => (
                <div key={q.q} className="py-5">
                  <p className="font-semibold text-[var(--color-text)]">{q.q}</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">{q.a}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-16 text-center">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary", size: "lg" })}>
            Start free - no credit card
          </Link>
        </section>

        {related.length > 0 ? (
          <section className="mt-20 border-t border-[var(--color-border)] pt-10">
            <p className="eyebrow text-center">Related features</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/features/${r.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
                >
                  {r.label} <ArrowRight size={13} />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
