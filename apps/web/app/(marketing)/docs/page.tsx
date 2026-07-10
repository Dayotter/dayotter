import { MarketingHeader } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import { BookOpen, Code2, Server, Webhook } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation — calSync",
  description: "Guides for using, self-hosting, and building on calSync.",
};

const GUIDES = [
  {
    icon: BookOpen,
    title: "Getting started",
    body: "Connect your calendars, create an event type, and share your booking link.",
    href: "/sign-up",
  },
  {
    icon: Server,
    title: "Self-hosting",
    body: "Run calSync on your own infrastructure with Docker — every feature, free.",
    href: "/self-hosting",
  },
  {
    icon: Code2,
    title: "REST API",
    body: "Authenticate with an API key and read/create bookings, event types, and availability under /api/v1.",
    href: BRAND.github,
    external: true,
  },
  {
    icon: Webhook,
    title: "Webhooks & embed",
    body: "Get signed booking.created / cancelled / rescheduled events, or drop the booking widget on your site.",
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
        subtitle="Everything you need to use, self-host, and build on calSync."
      />
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid gap-5 sm:grid-cols-2">
          {GUIDES.map((g) => {
            const inner = (
              <div className="h-full rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-border-strong)]">
                <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-soft)]">
                  <g.icon size={18} className="text-[var(--color-accent)]" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{g.title}</h2>
                <p className="mt-1.5 text-sm text-[var(--color-muted)]">{g.body}</p>
              </div>
            );
            return g.external ? (
              <a key={g.title} href={g.href} target="_blank" rel="noreferrer">
                {inner}
              </a>
            ) : (
              <Link key={g.title} href={g.href}>
                {inner}
              </Link>
            );
          })}
        </div>
        <p className="mt-10 text-center text-sm text-[var(--color-muted)]">
          Looking for something specific?{" "}
          <Link href="/contact" className="text-[var(--color-accent)] hover:underline">
            Ask us
          </Link>
          .
        </p>
      </section>
    </>
  );
}
