import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { GUIDES, getGuide } from "@/lib/docs";
import type { DocBlock } from "@/lib/docs";
import { AlertTriangle, ArrowLeft, ArrowRight, Info, Lightbulb } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return { title: "Docs" };
  const path = `/docs/${g.slug}`;
  return {
    title: `${g.title} - Docs`,
    description: g.summary,
    alternates: { canonical: path },
    openGraph: { title: `${g.title} - Docs`, description: g.summary, url: path },
  };
}

const anchor = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const CALLOUT = {
  tip: { Icon: Lightbulb, label: "Tip", tint: "var(--color-accent)" },
  note: { Icon: Info, label: "Note", tint: "var(--color-sky)" },
  warning: { Icon: AlertTriangle, label: "Heads up", tint: "var(--color-amber)" },
} as const;

function Callout({ tip }: { tip: NonNullable<DocBlock["tip"]> }) {
  const { Icon, label, tint } = CALLOUT[tip.kind ?? "tip"];
  return (
    <div
      className="my-6 flex gap-3 rounded-[var(--radius-lg)] border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${tint} 35%, transparent)`,
        background: `color-mix(in srgb, ${tint} 7%, var(--color-surface))`,
      }}
    >
      <Icon size={18} className="mt-0.5 shrink-0" style={{ color: tint }} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: tint }}>
          {label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--color-text)]">{tip.text}</p>
      </div>
    </div>
  );
}

export default async function DocGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = getGuide(slug);
  if (!g) notFound();

  const headings = g.body.filter((b) => b.heading).map((b) => b.heading as string);
  const idx = GUIDES.findIndex((x) => x.slug === g.slug);
  const prev = idx > 0 ? GUIDES[idx - 1] : undefined;
  const next = idx < GUIDES.length - 1 ? GUIDES[idx + 1] : undefined;
  const related = (g.related ?? [])
    .map((s) => getGuide(s))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));

  return (
    <article>
      <BreadcrumbJsonLd
        items={[
          { name: "Docs", path: "/docs" },
          { name: g.title, path: `/docs/${g.slug}` },
        ]}
      />
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-3xl px-6 py-14">
          <Link
            href="/docs"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <ArrowLeft size={15} /> All docs
          </Link>
          <p className="eyebrow mb-3">
            {g.category} · {g.readMinutes} min read
          </p>
          <h1 className="font-display text-4xl leading-[1.08] tracking-[-0.01em]">{g.title}</h1>
          <p className="mt-4 text-lg text-[var(--color-muted)]">{g.summary}</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl gap-10 px-6 py-14 lg:grid lg:grid-cols-[1fr_220px]">
        {/* Main content */}
        <div
          className="min-w-0 max-w-2xl text-[15px] leading-7 text-[var(--color-muted)]
            [&_a]:text-[var(--color-accent)] [&_a:hover]:underline
            [&_h2]:font-display [&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:tracking-[-0.01em] [&_h2]:text-[var(--color-text)]
            [&_p]:mb-4
            [&_strong]:font-semibold [&_strong]:text-[var(--color-text)]
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-2
            [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-2
            [&_li]:marker:text-[var(--color-faint)]"
        >
          {g.body.map((b, i) => (
            <div key={i}>
              {b.heading ? <h2 id={anchor(b.heading)}>{b.heading}</h2> : null}
              {b.paragraphs?.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
              {b.steps ? (
                <ol>
                  {b.steps.map((s) => (
                    <li key={s.slice(0, 24)}>{s}</li>
                  ))}
                </ol>
              ) : null}
              {b.bullets ? (
                <ul>
                  {b.bullets.map((s) => (
                    <li key={s.slice(0, 24)}>{s}</li>
                  ))}
                </ul>
              ) : null}
              {b.tip ? <Callout tip={b.tip} /> : null}
            </div>
          ))}

          {related.length > 0 ? (
            <section className="mt-14 border-t border-[var(--color-border)] pt-8">
              <p className="eyebrow mb-4">Related guides</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/docs/${r.slug}`}
                    className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
                  >
                    <p className="font-medium text-[var(--color-text)]">{r.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{r.summary}</p>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {/* Prev / next */}
          <nav className="mt-10 flex flex-col gap-3 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:justify-between">
            {prev ? (
              <Link
                href={`/docs/${prev.slug}`}
                className="group inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
              >
                <ArrowLeft
                  size={15}
                  className="transition-transform group-hover:-translate-x-0.5"
                />
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={`/docs/${next.slug}`}
                className="group inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)] sm:text-right"
              >
                {next.title}
                <ArrowRight
                  size={15}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            ) : (
              <span />
            )}
          </nav>

          <p className="mt-10 text-sm text-[var(--color-muted)]">
            Ready to try it? <Link href="/sign-up">Get started free</Link>, or browse{" "}
            <Link href="/docs">all guides</Link>.
          </p>
        </div>

        {/* On this page */}
        {headings.length > 1 ? (
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="eyebrow mb-3">On this page</p>
              <ul className="space-y-2 border-l border-[var(--color-border)]">
                {headings.map((h) => (
                  <li key={h}>
                    <a
                      href={`#${anchor(h)}`}
                      className="-ml-px block border-l border-transparent pl-3 text-sm text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
                    >
                      {h}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        ) : null}
      </div>
    </article>
  );
}
