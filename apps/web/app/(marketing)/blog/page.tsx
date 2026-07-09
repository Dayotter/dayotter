import { MarketingHeader } from "@/components/marketing/page-shell";
import { POSTS, formatDate } from "@/lib/blog";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Blog — calSync",
  description: "Notes on time, calendars, and building calSync in the open.",
};

export default function BlogPage() {
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <MarketingHeader
        eyebrow="Blog"
        title="Notes on time"
        subtitle="Thoughts on calendars, focus, and building calSync in the open."
      />
      <section className="mx-auto max-w-2xl px-6 py-16">
        <div className="space-y-2">
          {posts.map((p) => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="block rounded-[var(--radius-lg)] border border-transparent px-4 py-5 transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface)]"
            >
              <p className="text-xs text-[var(--color-faint)]">
                {formatDate(p.date)} · {p.readMinutes} min read
              </p>
              <h2 className="font-display mt-1 text-xl tracking-[-0.01em]">{p.title}</h2>
              <p className="mt-1.5 text-sm text-[var(--color-muted)]">{p.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
