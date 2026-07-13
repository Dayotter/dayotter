import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — DayOtter",
  description: "The terms that govern your use of DayOtter.",
};

export default function TermsPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Legal"
        title="Terms of Service"
        subtitle="Last updated July 14, 2026"
      />
      <Prose>
        <p>
          These Terms of Service ("Terms") govern your access to and use of {BRAND.name} (the
          "Service"). By creating an account or using the Service, you agree to these Terms. If you
          are using the Service on behalf of an organization, you agree on its behalf.
        </p>

        <h2>1. The Service</h2>
        <p>
          {BRAND.name} is a scheduling platform that connects your calendars, shares your
          availability, and lets people book time with you. We offer a hosted cloud edition and an
          open-source edition you can self-host. These Terms cover the hosted edition; the
          self-hosted edition is governed by its open-source license.
        </p>

        <h2>2. Accounts</h2>
        <p>
          You are responsible for your account, for keeping your credentials secure, and for all
          activity under it. You must be at least 16 years old, provide accurate information, and
          not share your account. Notify us promptly of any unauthorized use.
        </p>

        <h2>3. Plans and billing</h2>
        <p>
          Paid plans are billed per seat, in advance, on a recurring basis until cancelled. You
          authorize us and our payment processor (Stripe) to charge your payment method. Fees are
          non-refundable except where required by law. You can cancel anytime; your plan remains
          active until the end of the current period, after which it reverts to the free plan.
        </p>

        <h2>4. Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>use the Service to send spam, phishing, or unlawful content;</li>
          <li>attempt to breach security, probe, or disrupt the Service;</li>
          <li>reverse-engineer or resell the hosted Service except as permitted;</li>
          <li>infringe others' rights or violate applicable law.</li>
        </ul>

        <h2>5. Your content</h2>
        <p>
          You retain ownership of the data you put into the Service (event types, bookings, calendar
          data, and messages). You grant us the limited rights needed to operate the Service on your
          behalf — for example, storing your data and syncing your calendars. We do not sell your
          data. See our <a href="/privacy">Privacy Policy</a>.
        </p>

        <h2>6. Third-party services</h2>
        <p>
          The Service integrates with third parties such as Google, Microsoft, Apple, and Stripe.
          Your use of those services is subject to their own terms, and we are not responsible for
          them.
        </p>

        <h2>7. Availability & changes</h2>
        <p>
          We work hard to keep the Service available but do not guarantee uninterrupted access. We
          may modify, suspend, or discontinue features, and we may update these Terms; material
          changes will be announced with reasonable notice.
        </p>

        <h2>8. AI features</h2>
        <p>
          {BRAND.name} includes an AI assistant ("Otter") that drafts events, suggestions, and
          replies. Otter is confirm-first — it proposes actions and only carries them out after you
          confirm. AI output can be inaccurate or incomplete, so you are responsible for reviewing
          any draft before confirming it. Don't rely on AI output as professional advice.
        </p>

        <h2>9. Disclaimers & liability</h2>
        <p>
          The Service is provided "as is" without warranties of any kind. To the maximum extent
          permitted by law, {BRAND.name} is not liable for indirect, incidental, or consequential
          damages, and our total liability is limited to the amount you paid in the twelve months
          before the claim.
        </p>

        <h2>10. Termination</h2>
        <p>
          You may stop using the Service at any time. We may suspend or terminate access if you
          breach these Terms. On termination you may export your data for a reasonable period.
        </p>

        <h2>11. Contact</h2>
        <p>
          Questions about these Terms? Email <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
        </p>

        <hr />
        <p>
          <em>
            This document is a plain-language template and not legal advice. Consult a lawyer before
            relying on it for your business.
          </em>
        </p>
      </Prose>
    </>
  );
}
