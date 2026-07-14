/** Brand + marketing constants. One place for links, contact, and footer nav. */

export const BRAND = {
  name: "DayOtter",
  tagline: "The calm home for your time.",
  /** Canonical site origin - drives metadataBase, sitemap, canonical URLs, JSON-LD. */
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://dayotter.com",
  email: "hello@dayotter.com",
  github: "https://github.com/nometria/dayotter",
  githubLicense: "https://github.com/nometria/dayotter/blob/main/LICENSE",
  githubContributing: "https://github.com/nometria/dayotter/blob/main/CONTRIBUTING.md",
  x: "https://x.com/dayotter",
  copyrightYear: 2026,
};

export interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

/** Footer navigation. Every link resolves to a real page or landing anchor. */
export const FOOTER_COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Integrations", href: "/integrations" },
      { label: "Pricing", href: "/pricing" },
      { label: "How it works", href: "/#how" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "vs Calendly", href: "/vs/calendly" },
      { label: "vs Cal.com", href: "/vs/cal-com" },
      { label: "vs Google Calendar", href: "/vs/google-calendar" },
      { label: "vs Motion", href: "/vs/motion" },
      { label: "vs Reclaim", href: "/vs/reclaim" },
      { label: "All comparisons", href: "/vs" },
    ],
  },
  {
    title: "For",
    links: [
      { label: "Founders", href: "/for/founders" },
      { label: "Teams", href: "/for/teams" },
      { label: "Sales teams", href: "/for/sales" },
      { label: "Agencies", href: "/for/agencies" },
      { label: "Consultants", href: "/for/consultants" },
      { label: "Recruiters", href: "/for/recruiters" },
      { label: "ADHD & busy minds", href: "/for/adhd" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "Self-hosting", href: "/self-hosting" },
      { label: "Blog", href: "/blog" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "Status", href: "/status" },
    ],
  },
];

/** Top-nav links shown on marketing pages. */
export const MARKETING_NAV: FooterLink[] = [
  { label: "Features", href: "/features" },
  { label: "Integrations", href: "/integrations" },
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/vs" },
  { label: "Docs", href: "/docs" },
];
