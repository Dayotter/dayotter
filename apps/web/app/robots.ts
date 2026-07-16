import { BRAND } from "@/lib/marketing";
import type { MetadataRoute } from "next";

// Private/app + auth surfaces stay out of every crawler's index.
const DISALLOW = ["/api/", "/dashboard", "/settings", "/sign-in", "/sign-up", "/onboarding"];

// GEO: explicitly welcome the major AI/answer-engine crawlers to the public
// content (they inherit "*" anyway, but naming them signals intent and future-
// proofs against a default-deny stance). They still can't reach the app/auth
// surfaces above. The public content is also summarized at /llms.txt.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "Amazonbot",
  "cohere-ai",
  "Meta-ExternalAgent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: DISALLOW },
    ],
    sitemap: `${BRAND.url}/sitemap.xml`,
    host: BRAND.url,
  };
}
