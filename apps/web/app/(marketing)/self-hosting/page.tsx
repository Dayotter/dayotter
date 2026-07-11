import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Self-hosting — dayotter",
  description: "Run dayotter on your own infrastructure. Every feature, free forever.",
};

export default function SelfHostingPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Open source"
        title="Self-host dayotter"
        subtitle="Your data, your servers, every feature unlocked — free forever under Apache-2.0."
      />
      <Prose>
        <p>
          The open-source edition of {BRAND.name} is the whole product. There's no license key and
          no paywall — the differentiator features (AI, automations, analytics, and more) are all
          free when you run it yourself. Just leave the cloud edition off.
        </p>

        <h2>Requirements</h2>
        <ul>
          <li>Docker & Docker Compose (or Node 20+ and pnpm)</li>
          <li>Postgres and Redis (bundled in the compose file)</li>
          <li>OAuth credentials for the calendars you want to sync</li>
        </ul>

        <h2>Quick start</h2>
        <p>Clone the repo, copy the env template, and bring it up:</p>
        <ul>
          <li>
            <code>git clone {BRAND.github}.git</code>
          </li>
          <li>
            <code>cp .env.example .env</code> — then fill in secrets
          </li>
          <li>
            <code>docker compose --profile app up -d</code>
          </li>
        </ul>
        <p>
          Generate a real <code>ENCRYPTION_KEY</code> (32 bytes, hex) and set{" "}
          <code>AUTH_SECRET</code> — the app refuses to start with placeholders. Point{" "}
          <code>DATABASE_URL</code> and <code>REDIS_URL</code> at your datastores and run the
          migrations.
        </p>

        <h2>What you configure</h2>
        <p>
          Bring your own keys for the optional pieces: Google/Microsoft/Apple calendar OAuth, Stripe
          (to accept payments), Twilio (SMS/WhatsApp reminders), and an Anthropic key (AI features).
          Anything you don't configure simply stays off.
        </p>

        <h2>Cloud vs. self-hosted</h2>
        <p>
          The hosted edition adds a managed free tier, the $9/seat Pro plan, and a few managed-only
          extras. See <a href="/pricing">pricing</a> for the full comparison, or read the docs to go
          deeper.
        </p>

        <p>
          Full instructions live in the{" "}
          <a href={BRAND.github} target="_blank" rel="noreferrer">
            README on GitHub
          </a>
          .
        </p>
      </Prose>
    </>
  );
}
