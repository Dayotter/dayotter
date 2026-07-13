import { Prose } from "@/components/marketing/page-shell";
import { GUIDES, getGuide } from "@/lib/docs";
import { ArrowLeft } from "lucide-react";
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
  if (!g) return { title: "Docs — DayOtter" };
  return { title: `${g.title} — DayOtter Docs`, description: g.summary };
}

export default async function DocGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const g = getGuide((await params).slug);
  if (!g) notFound();

  return (
    <article>
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-2xl px-6 py-14">
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

      <Prose>
        {g.body.map((b, i) => (
          <div key={i}>
            {b.heading ? <h2>{b.heading}</h2> : null}
            {b.paragraphs?.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
            {b.steps ? (
              <ol>
                {b.steps.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ol>
            ) : null}
            {b.bullets ? (
              <ul>
                {b.bullets.map((s, j) => (
                  <li key={j}>{s}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
        <hr />
        <p>
          Ready to try it? <Link href="/sign-up">Get started free</Link>, or browse{" "}
          <Link href="/docs">all guides</Link>.
        </p>
      </Prose>
    </article>
  );
}
