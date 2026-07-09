import { Prose } from "@/components/marketing/page-shell";
import { POSTS, formatDate, getPost } from "@/lib/blog";
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const post = getPost((await params).slug);
  if (!post) return { title: "Blog — calSync" };
  return { title: `${post.title} — calSync`, description: post.excerpt };
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();

  return (
    <article>
      <header className="relative overflow-hidden border-b border-[var(--color-border)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-[0.1]"
          style={{
            background: "radial-gradient(50% 60% at 50% 0%, var(--color-accent) 0%, transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-2xl px-6 py-16">
          <Link
            href="/blog"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-text)]"
          >
            <ArrowLeft size={15} /> All posts
          </Link>
          <p className="eyebrow mb-3">
            {formatDate(post.date)} · {post.readMinutes} min read
          </p>
          <h1 className="font-display text-4xl leading-[1.08] tracking-[-0.01em]">{post.title}</h1>
          <p className="mt-4 text-lg text-[var(--color-muted)]">{post.excerpt}</p>
          <p className="mt-4 text-sm text-[var(--color-faint)]">By {post.author}</p>
        </div>
      </header>

      <Prose>
        {post.body.map((block, i) => (
          <div key={i}>
            {block.heading ? <h2>{block.heading}</h2> : null}
            {block.paragraphs.map((p, j) => (
              <p key={j}>{p}</p>
            ))}
          </div>
        ))}
        <hr />
        <p>
          Ready to try it?{" "}
          <Link href="/sign-up">Get started free</Link> or{" "}
          <Link href="/pricing">see pricing</Link>.
        </p>
      </Prose>
    </article>
  );
}
