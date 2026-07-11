import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — dayotter",
  description: "How dayotter protects your data.",
};

export default function SecurityPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Trust"
        title="Security"
        subtitle="Scheduling touches your most sensitive data. Here's how we protect it."
      />
      <Prose>
        <h2>Encryption</h2>
        <p>
          Calendar OAuth tokens, notification-channel secrets, and webhook signing keys are
          encrypted at rest with AES-256-GCM. API keys are stored only as SHA-256 hashes — we never
          keep the plaintext. All traffic is served over HTTPS.
        </p>

        <h2>Access & isolation</h2>
        <p>
          Every record belongs to a user and an organization, and every request is scoped to the
          authenticated account — there's no cross-tenant access. The authenticated app is protected
          against clickjacking, and public booking links use unguessable capability tokens.
        </p>

        <h2>Payments</h2>
        <p>
          Payments run through Stripe. We never see or store card numbers — only a customer
          reference. Stripe webhooks are signature-verified and fulfillment is idempotent.
        </p>

        <h2>Outbound webhooks</h2>
        <p>
          Webhooks you configure are delivered from validated, public destinations only (we block
          internal/loopback targets to prevent SSRF), signed with an HMAC over the payload plus a
          timestamp so you can reject replays.
        </p>

        <h2>Self-hosting</h2>
        <p>
          Prefer full control? Self-host {BRAND.name} and your data never leaves your
          infrastructure. See the <a href="/self-hosting">self-hosting guide</a>.
        </p>

        <h2>Reporting a vulnerability</h2>
        <p>
          Found something? We appreciate responsible disclosure — email{" "}
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> and we'll respond promptly.
        </p>
      </Prose>
    </>
  );
}
