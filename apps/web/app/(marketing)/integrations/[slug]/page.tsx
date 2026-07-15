import { MarketingHeader } from "@/components/marketing/page-shell";
import { BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { INTEGRATIONS, getIntegration } from "@/lib/integrations-content";
import { ArrowRight, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return INTEGRATIONS.map((i) => ({ slug: i.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const it = getIntegration((await params).slug);
  if (!it) return { title: "Integrations" };
  const path = `/integrations/${it.slug}`;
  const title = `${it.name} scheduling - DayOtter integration`;
  return {
    title,
    description: it.subtitle,
    alternates: { canonical: path },
    openGraph: { title, description: it.subtitle, url: path },
  };
}

export default async function IntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const it = getIntegration(slug);
  if (!it) notFound();
  const others = INTEGRATIONS.filter((x) => x.slug !== slug).slice(0, 6);

  return (
    <>
      <FaqJsonLd items={it.faq} />
      <BreadcrumbJsonLd
        items={[
          { name: "Integrations", path: "/integrations" },
          { name: it.name, path: `/integrations/${it.slug}` },
        ]}
      />
      <MarketingHeader
        eyebrow={`${it.category} integration`}
        title={`DayOtter + ${it.name}`}
        subtitle={it.subtitle}
      />

      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-14 flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ variant: "primary" })}>
            Connect {it.name}
          </Link>
          <Link href="/integrations" className={buttonVariants({ variant: "outline" })}>
            All integrations
          </Link>
        </div>

        <section className="mx-auto max-w-2xl space-y-4">
          {it.intro.map((p) => (
            <p
              key={p.slice(0, 24)}
              className="text-[15px] leading-relaxed text-[var(--color-muted)]"
            >
              {p}
            </p>
          ))}
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2">
          {it.points.map((pt) => (
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

        {it.faq.length > 0 ? (
          <section className="mx-auto mt-20 max-w-2xl">
            <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
              {it.faq.map((q) => (
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

        <section className="mt-20 border-t border-[var(--color-border)] pt-10">
          <p className="eyebrow text-center">More integrations</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {others.map((o) => (
              <Link
                key={o.slug}
                href={`/integrations/${o.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-3.5 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                {o.name} <ArrowRight size={13} />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
