import { POSTS } from "@/lib/blog";
import { COMPARISONS } from "@/lib/comparisons";
import { GUIDES } from "@/lib/docs";
import { FEATURES } from "@/lib/features";
import { GLOSSARY } from "@/lib/glossary";
import { INTEGRATIONS } from "@/lib/integrations-content";
import { BRAND } from "@/lib/marketing";
import { PERSONAS } from "@/lib/personas";

export const dynamic = "force-static";

/**
 * `/llms.txt` - the llmstxt.org convention: a single, link-rich Markdown file
 * that gives AI/answer engines a clean map of the site's public content, built
 * from the same content collections as the sitemap so it never drifts.
 */
function line(path: string, label: string, desc?: string): string {
  return `- [${label}](${BRAND.url}${path})${desc ? `: ${desc}` : ""}`;
}

function section(title: string, lines: string[]): string {
  return `## ${title}\n${lines.join("\n")}\n`;
}

export function GET(): Response {
  const body = [
    `# ${BRAND.name}`,
    "",
    "> DayOtter is the AI-native, open-source scheduling platform. Its assistant, Otter, books meetings, protects focus, and clears the scheduling back-and-forth - always confirm-first (it drafts, a human approves). Sync every calendar, run team round-robin and collective scheduling, accept payments, and self-host the whole thing under AGPLv3.",
    "",
    "Key facts:",
    "- Open-source (AGPLv3); self-hostable in one command; managed cloud at dayotter.com.",
    "- A privacy-respecting alternative to Calendly, Cal.com, Motion, and Reclaim, and to manual Google Calendar back-and-forth.",
    "- Otter (the AI) is confirm-first: it never changes a calendar on its own, it proposes an action the user approves.",
    "- Free tier plus a $9/seat/month Pro plan on the cloud edition; all features are unlocked when self-hosted.",
    "",
    section("Start here", [
      line("/", "Home", "What DayOtter is and who it's for."),
      line("/features", "Features", "Everything DayOtter does, by capability."),
      line("/pricing", "Pricing", "Free tier and $9/seat/mo Pro; self-hosting is free."),
      line("/integrations", "Integrations", "Calendars, video, payments, CRM, and messaging."),
      line("/self-hosting", "Self-hosting", "Run the whole platform on your own server."),
      line("/security", "Security", "Encryption at rest, signed webhooks, SSRF-safe egress."),
      line("/docs", "Documentation", "Guides from first booking to advanced setup."),
    ]),
    section(
      "Features",
      FEATURES.map((f) => line(`/features/${f.slug}`, f.title, f.blurb)),
    ),
    section(
      "Comparisons",
      COMPARISONS.map((c) => line(`/vs/${c.slug}`, c.title, c.blurb)),
    ),
    section(
      "For teams & roles",
      PERSONAS.map((p) => line(`/for/${p.slug}`, p.title, p.subtitle)),
    ),
    section(
      "Integrations",
      INTEGRATIONS.map((i) => line(`/integrations/${i.slug}`, i.name, i.blurb)),
    ),
    section(
      "Documentation",
      GUIDES.map((g) => line(`/docs/${g.slug}`, g.title, g.summary)),
    ),
    section(
      "Glossary",
      GLOSSARY.map((t) => line(`/glossary/${t.slug}`, t.term, t.short)),
    ),
    section(
      "Blog",
      POSTS.map((p) => line(`/blog/${p.slug}`, p.title, p.excerpt)),
    ),
    section("More", [
      `- [Source code](${BRAND.github}): GitHub repository (issues + contributions welcome).`,
      line("/changelog", "Changelog", "What shipped, including security fixes."),
      line("/about", "About", "Why DayOtter exists."),
      line("/contact", "Contact", "Get in touch."),
    ]),
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
