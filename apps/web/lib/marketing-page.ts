import type { Metadata } from "next";

/**
 * Shared metadata scaffolding for the programmatic marketing `[slug]` pages
 * (/vs, /for, /features, /integrations, /glossary). Each of those pages built
 * the same title/description/canonical/openGraph shape by hand; this centralizes
 * it so the SEO tags stay consistent and there's one place to change them.
 */

/** Build a Metadata object with matching canonical + OpenGraph from one source. */
export function slugMetadata(opts: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: { title: opts.title, description: opts.description, url: opts.path },
  };
}

/**
 * Make a Next.js `generateMetadata` for a `[slug]` page: look the entity up,
 * fall back to a title when it's missing, otherwise map it to title/description/
 * path and return consistent metadata.
 */
export function makeSlugMetadata<T>(
  get: (slug: string) => T | undefined,
  build: (item: T) => { title: string; description: string; path: string },
  fallbackTitle: string,
) {
  return async ({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }): Promise<Metadata> => {
    const item = get((await params).slug);
    if (!item) return { title: fallbackTitle };
    return slugMetadata(build(item));
  };
}
