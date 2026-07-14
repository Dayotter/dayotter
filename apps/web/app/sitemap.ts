import { POSTS } from "@/lib/blog";
import { COMPARISONS } from "@/lib/comparisons";
import { GUIDES } from "@/lib/docs";
import { FEATURES } from "@/lib/features";
import { INTEGRATIONS } from "@/lib/integrations-content";
import { BRAND } from "@/lib/marketing";
import { PERSONAS } from "@/lib/personas";
import type { MetadataRoute } from "next";

/** Dynamic sitemap — every public page, so search engines can crawl the lot. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = BRAND.url;
  const now = new Date();

  const entry = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly",
  ) => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority });

  return [
    entry("", 1, "daily"),
    entry("/pricing", 0.9),
    entry("/features", 0.9),
    entry("/integrations", 0.9),
    entry("/vs", 0.8),
    entry("/self-hosting", 0.8),
    entry("/blog", 0.7),
    entry("/docs", 0.7),
    entry("/about", 0.5),
    entry("/security", 0.5),
    entry("/contact", 0.5),
    entry("/changelog", 0.4),
    entry("/status", 0.3),
    entry("/privacy", 0.3),
    entry("/terms", 0.3),
    ...FEATURES.map((f) => entry(`/features/${f.slug}`, 0.7)),
    ...INTEGRATIONS.map((i) => entry(`/integrations/${i.slug}`, 0.7)),
    ...COMPARISONS.map((c) => entry(`/vs/${c.slug}`, 0.8)),
    ...PERSONAS.map((p) => entry(`/for/${p.slug}`, 0.7)),
    ...POSTS.map((p) => entry(`/blog/${p.slug}`, 0.6)),
    ...GUIDES.map((g) => entry(`/docs/${g.slug}`, 0.5)),
  ];
}
