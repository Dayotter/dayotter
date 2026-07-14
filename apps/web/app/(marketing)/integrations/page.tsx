import { MarketingHeader } from "@/components/marketing/page-shell";
import { INTEGRATIONS } from "@/lib/integrations-content";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Integrations",
  description:
    "DayOtter connects with Google Calendar, Outlook, Apple iCloud, Zoom, Google Meet, Teams, Slack, WhatsApp, and Stripe - one calm scheduling layer over the tools you already use.",
  alternates: { canonical: "/integrations" },
};

const CATEGORIES = ["Calendar", "Video", "Messaging", "Payments"] as const;

export default function IntegrationsPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Integrations"
        title="Works with the tools you already use"
        subtitle="DayOtter is a scheduling layer on top of your calendar, video, and messaging tools - not a replacement. Connect and go."
      />

      <section className="mx-auto max-w-5xl px-6 py-16">
        {CATEGORIES.map((cat) => {
          const items = INTEGRATIONS.filter((i) => i.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-12">
              <h2 className="eyebrow mb-4">{cat}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((i) => (
                  <Link
                    key={i.slug}
                    href={`/integrations/${i.slug}`}
                    className="group flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-accent)]"
                  >
                    <p className="font-semibold text-[var(--color-text)]">{i.name}</p>
                    <p className="mt-1.5 flex-1 text-sm leading-relaxed text-[var(--color-muted)]">
                      {i.blurb}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-accent)]">
                      Learn more{" "}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
