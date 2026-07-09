/** Brand + marketing constants. One place for links, contact, and footer nav. */

export const BRAND = {
  name: "calSync",
  tagline: "The open-source home for your time.",
  email: "hello@calsync.com",
  github: "https://github.com/calsync/calsync",
  githubLicense: "https://github.com/calsync/calsync/blob/main/LICENSE",
  githubContributing: "https://github.com/calsync/calsync/blob/main/CONTRIBUTING.md",
  x: "https://x.com/calsync",
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
      { label: "Pricing", href: "/pricing" },
      { label: "Features", href: "/#features" },
      { label: "How it works", href: "/#how" },
      { label: "Mobile app", href: "/#mobile" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Documentation", href: "/docs" },
      { label: "Self-hosting", href: "/self-hosting" },
      { label: "Status", href: "/status" },
      { label: "GitHub", href: BRAND.github, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Security", href: "/security" },
      { label: "License", href: BRAND.githubLicense, external: true },
    ],
  },
];

/** Top-nav links shown on marketing pages. */
export const MARKETING_NAV: FooterLink[] = [
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Docs", href: "/docs" },
];
