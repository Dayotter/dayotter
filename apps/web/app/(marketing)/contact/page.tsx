import { ContactForm } from "@/components/marketing/contact-form";
import { MarketingHeader } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import { Github, Mail, MessageSquare } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — calSync",
  description: "Get in touch with the calSync team.",
};

export default function ContactPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Contact"
        title="Let's talk"
        subtitle="Questions, feedback, or just want to say hi? We read everything."
      />
      <section className="mx-auto grid max-w-4xl gap-10 px-6 py-16 md:grid-cols-2">
        <div className="space-y-6">
          <Item icon={Mail} title="Email us" body={BRAND.email} href={`mailto:${BRAND.email}`} />
          <Item
            icon={Github}
            title="Open an issue"
            body="Bugs, feature requests & discussions"
            href={BRAND.github}
            external
          />
          <Item
            icon={MessageSquare}
            title="Sales & teams"
            body="Rolling calSync out to your team? We'll help."
            href={`mailto:${BRAND.email}`}
          />
        </div>
        <ContactForm />
      </section>
    </>
  );
}

function Item({
  icon: Icon,
  title,
  body,
  href,
  external,
}: {
  icon: typeof Mail;
  title: string;
  body: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)]">
        <Icon size={16} className="text-[var(--color-accent)]" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-[var(--color-muted)]">{body}</p>
      </div>
    </a>
  );
}
