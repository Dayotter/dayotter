import { MarketingHeader } from "@/components/marketing/page-shell";
import { DOC_CATEGORIES, GUIDES } from "@/lib/docs";
import { BRAND } from "@/lib/marketing";
import { ArrowUpRight, Code2, Server, Webhook } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation — DayOtter",
  description: "Guides for setting up, using, and building on DayOtter.",
};

const BUILD_LINKS = [
  {
    icon: Server,
    title: "Self-hosting",
    body: "Run the whole thing on your own infrastructure with Docker.",
    href: "/self-hosting",
  },
  {
    icon: Code2,
    title: "REST API",
    body: "API keys + /api/v1 for bookings, event types, and availability.",
    href: BRAND.github,
    external: true,
  },
  {
    icon: Webhook,
    title: "Webhooks & embed",
    body: "Signed booking events, or drop the booking widget on your site.",
    href: BRAND.github,
    external: true,
  },
];

export default function DocsPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Docs"
        title="Documentation"
        subtitle="Short, task-focused guides to get you booked — and a few pointers for building on DayOtter."
      />
      <section className="mx-auto max-w-3xl px-6 py-16">
        {DOC_CATEGORIES.map((cat) => {
          const guides = GUIDES.filter((g) => g.category === cat);
          if (guides.length === 0) return null;
          return (
            <div key={cat} className="mb-12">
              <p className="eyebrow mb-4">{cat}</p>
              <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                {guides.map((g) => (
                  <Link
                    key={g.slug}
                    href={`/docs/${g.slug}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[var(--color-surface-2)]"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{g.title}</p>
                      <p className="mt-0.5 text-sm text-[var(--color-muted)]">{g.summary}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-[var(--color-faint)]">
                      {g.readMinutes} min
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        <p className="eyebrow mb-4">Build on DayOtter</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {BUILD_LINKS.map((l) => {
            const inner = (
              <div
                key={l.title}
                className="h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-border-strong)]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)]">
                  <l.icon size={16} className="text-[var(--color-accent)]" />
                </div>
                <p className="mt-3 flex items-center gap-1 font-medium">
                  {l.title}
                  {l.external ? (
                    <ArrowUpRight size={13} className="text-[var(--color-faint)]" />
                  ) : null}
                </p>
                <p className="mt-1 text-sm text-[var(--color-muted)]">{l.body}</p>
              </div>
            );
            return l.external ? (
              <a key={l.title} href={l.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <Link key={l.title} href={l.href}>
                {inner}
              </Link>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
          Can't find what you need?{" "}
          <Link href="/contact" className="text-[var(--color-accent)] hover:underline">
            Ask us
          </Link>
          .
        </p>
      </section>
    </>
  );
}
