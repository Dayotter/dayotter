import { MarketingHeader } from "@/components/marketing/page-shell";
import { FaqJsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { PRO_PRICE_USD } from "@/lib/billing/edition";
import { BRAND } from "@/lib/marketing";
import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Free forever for individuals. Pro is $9/seat/mo for the whole team. Or self-host every feature for free under AGPLv3.",
  alternates: { canonical: "/pricing" },
};

interface Tier {
  name: string;
  price: string;
  cadence?: string;
  tagline: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean; variant: "primary" | "outline" };
  featured?: boolean;
}

const TIERS: Tier[] = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Everything one person needs to get booked - Otter included.",
    features: [
      "Otter - your AI scheduling assistant",
      "Unlimited event types & booking pages",
      "Google, Microsoft & Apple calendar sync",
      "Deep-work & focus-time defense",
      "CRM sync - Salesforce & HubSpot",
      "Developer API, webhooks & embed",
      "Slack & WhatsApp reminders",
      "Group polls, email reminders & confirmations",
    ],
    cta: { label: "Get started", href: "/sign-up", variant: "outline" },
  },
  {
    name: "Pro",
    price: `$${PRO_PRICE_USD}`,
    cadence: "per seat / month",
    tagline: "The full toolkit for teams that live in their calendar.",
    features: [
      "Everything in Free",
      "Team scheduling - weighted round-robin & collective",
      "Routing forms - qualify & route inbound",
      "Adaptive availability & travel-aware scheduling",
      "Automations & attendee workflows",
      "Booking analytics & CSV export",
      "SMS reminders",
      "Accept payments",
    ],
    cta: { label: "Start with Pro", href: "/sign-up", variant: "primary" },
    featured: true,
  },
  {
    name: "Self-hosted",
    price: "Free",
    cadence: "open source",
    tagline: "Run DayOtter on your own infrastructure - every feature, unlocked.",
    features: [
      "Every Pro feature, free forever",
      "Your data on your servers",
      "AGPLv3 licensed core",
      "Docker & docker-compose",
      "Community support",
    ],
    cta: { label: "View on GitHub", href: BRAND.github, external: true, variant: "outline" },
  },
];

const FAQ = [
  {
    q: "How does DayOtter compare to Calendly or Cal.com?",
    a: "You get the scheduling table stakes both have - team round-robin & collective, routing forms, recurring meetings, group polls, workflows, payments and calendar sync - at $9/seat, below Calendly ($10–20) and Cal.com's team plan. Our free plan is genuinely usable (unlimited event types) instead of one-event-only. And we add what neither does: Otter, a proactive AI assistant that protects your focus time and flags overflow - plus an open-source core you can self-host.",
  },
  {
    q: "Is DayOtter really free?",
    a: "Yes. Individuals get a genuinely useful free plan on the cloud, and if you self-host, every feature - including the Pro ones - is free forever. You only pay for Pro on our hosted product.",
  },
  {
    q: "How does per-seat billing work?",
    a: "Pro is $9 per team member per month. Solo? That's just $9/mo. Your whole team shares one subscription, and you can manage seats anytime from the billing portal.",
  },
  {
    q: "What's the difference between cloud and self-hosting?",
    a: "The open-source edition you run yourself is fully featured and free. Our hosted cloud adds a free tier plus the $9/seat Pro plan, and takes the ops off your hands - managed AI and hosted messaging today, with team extras like SSO and custom booking domains on the way.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Anytime, from the billing portal. Your plan stays active until the end of the period, then drops to Free - nothing is deleted.",
  },
];

export default function PricingPage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />
      <MarketingHeader
        eyebrow="Pricing"
        title="Simple pricing for time well spent"
        subtitle="Free for individuals. $9/seat for teams. Or self-host everything for free."
      />

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={
                t.featured
                  ? "relative rounded-[var(--radius-xl)] border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-raise)]"
                  : "rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-7 shadow-[var(--shadow-card)]"
              }
            >
              {t.featured ? (
                <span className="absolute -top-3 left-7 rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="font-display text-2xl tracking-[-0.01em]">{t.name}</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">{t.price}</span>
                {t.cadence ? (
                  <span className="text-sm text-[var(--color-muted)]">{t.cadence}</span>
                ) : null}
              </div>
              <p className="mt-3 min-h-[44px] text-sm text-[var(--color-muted)]">{t.tagline}</p>
              {t.cta.external ? (
                <a
                  href={t.cta.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`${buttonVariants({ variant: t.cta.variant })} mt-5 w-full`}
                >
                  {t.cta.label}
                </a>
              ) : (
                <Link
                  href={t.cta.href}
                  className={`${buttonVariants({ variant: t.cta.variant })} mt-5 w-full`}
                >
                  {t.cta.label}
                </Link>
              )}
              <ul className="mt-7 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check size={16} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
          No credit card to start · The free plan is forever, not a trial · Cancel anytime
        </p>
      </section>

      <section className="mx-auto max-w-2xl px-6 pb-24">
        <h2 className="font-display mb-8 text-center text-3xl tracking-[-0.01em]">
          Questions, answered
        </h2>
        <div className="divide-y divide-[var(--color-border)] border-y border-[var(--color-border)]">
          {FAQ.map((item) => (
            <div key={item.q} className="py-6">
              <h3 className="font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{item.a}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-[var(--color-muted)]">
          Still deciding?{" "}
          <Link href="/contact" className="text-[var(--color-accent)] hover:underline">
            Talk to us
          </Link>
          .
        </p>
      </section>
    </>
  );
}
