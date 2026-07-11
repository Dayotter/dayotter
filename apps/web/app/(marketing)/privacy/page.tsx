import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — DayOtter",
  description: "How DayOtter collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Legal"
        title="Privacy Policy"
        subtitle="Last updated July 11, 2026"
      />
      <Prose>
        <p>
          Your calendar is deeply personal. This policy explains what {BRAND.name} collects, why,
          and the control you have. In short: we collect the minimum needed to run scheduling for
          you, we never sell your data, and sensitive tokens are encrypted at rest.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account data</strong> — your name, email, timezone, and booking handle.
          </li>
          <li>
            <strong>Calendar data</strong> — connections and busy/free times we sync to compute your
            availability. OAuth tokens are encrypted at rest (AES-256-GCM).
          </li>
          <li>
            <strong>Booking data</strong> — event types, bookings, attendees' names/emails, and any
            intake answers.
          </li>
          <li>
            <strong>Usage data</strong> — basic analytics about how the product is used, and (on
            public booking pages) anonymous view counts to power your funnel analytics.
          </li>
          <li>
            <strong>Payment data</strong> — handled by Stripe; we store only a customer/subscription
            reference, never card numbers.
          </li>
        </ul>

        <h2>How we use it</h2>
        <p>
          To provide scheduling — syncing calendars, computing availability, creating bookings,
          sending reminders and confirmations — and to operate, secure, and improve the Service. We
          process data to perform our contract with you and for our legitimate interest in running a
          reliable product.
        </p>

        <h2>How we share it</h2>
        <p>
          We share data only with the processors needed to run the Service: calendar providers
          (Google, Microsoft, Apple) you connect, email/SMS providers for reminders, and Stripe for
          payments. We do not sell your personal data or share it for advertising.
        </p>

        <h2>Security</h2>
        <p>
          OAuth tokens, notification secrets, and webhook signing keys are encrypted at rest. API
          keys are stored only as hashes. Access is scoped per user and organization. See our{" "}
          <a href="/security">security page</a> for details.
        </p>

        <h2>Retention</h2>
        <p>
          We keep your data while your account is active. When you delete data or your account, we
          remove it within a reasonable period, except where we must retain records for legal or
          accounting reasons.
        </p>

        <h2>Your rights</h2>
        <p>
          Depending on where you live, you may have rights to access, correct, export, or delete
          your data, and to object to certain processing. You can export your bookings from the app
          and manage connections and channels in settings, or email us to exercise any right.
        </p>

        <h2>Self-hosting</h2>
        <p>
          If you self-host {BRAND.name}, your data lives on your own infrastructure and this policy
          does not apply — you are the data controller.
        </p>

        <h2>Contact</h2>
        <p>
          Privacy questions or requests? Email <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>.
        </p>

        <hr />
        <p>
          <em>This is a plain-language template, not legal advice.</em>
        </p>
      </Prose>
    </>
  );
}
