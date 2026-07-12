import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — DayOtter",
  description: "Why we built DayOtter — the open-source home for your time.",
};

export default function AboutPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="About"
        title="Software that respects your time"
        subtitle="DayOtter is the open-source home for your calendar — built for people who guard their hours."
      />
      <Prose>
        <p>
          We built {BRAND.name} because your time is the one thing you can't get back. It deserves
          software that treats it that way — not another tool that fragments your day, buries you in
          notifications, or holds your data hostage.
        </p>

        <h2>Why an otter?</h2>
        <p>
          Otters are unusually deliberate with their time. They float on their backs to rest, keep
          their one favorite tool tucked in a pouch, and hold hands in a raft so the current never
          pulls the group apart. That's the whole idea: stay calm, keep what matters close, and make
          sure your team drifts together — not apart. {BRAND.name} guards your hours the way an
          otter guards its afternoon.
        </p>

        <h2>Open at the core</h2>
        <p>
          The entire scheduling engine is open source under Apache-2.0. Run it yourself and every
          feature is free, forever. Or use our cloud and let us handle the servers. Either way, your
          calendar data is yours — OAuth tokens are encrypted at rest, and we never sell what you
          put in.
        </p>

        <h2>Calendar-first, always</h2>
        <p>
          {BRAND.name} does one thing and does it deeply: it understands when you're actually free
          across every calendar you own, shares that cleanly, and lets people book you. The smart
          bits — AI suggestions, automations, adaptive availability — are confirm-first: they
          propose, you decide. We never silently rearrange your day.
        </p>

        <h2>Built in the open</h2>
        <p>
          We ship fast and in public. Follow along, file issues, or send a pull request on{" "}
          <a href={BRAND.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          .
        </p>

        <hr />
        <p>
          <em>Made for people who value their time.</em>
        </p>
      </Prose>
    </>
  );
}
