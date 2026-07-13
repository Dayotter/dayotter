import { MarketingHeader, Prose } from "@/components/marketing/page-shell";
import { BRAND } from "@/lib/marketing";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — DayOtter",
  description:
    "Why we built DayOtter — every calendar, your booking links, reminders, and an assistant in one calm place.",
};

export default function AboutPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="About"
        title="Software that respects your time"
        subtitle="DayOtter brings every calendar, your booking links, reminders, and a scheduling assistant into one calm place — built for people who guard their hours."
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

        <h2>Yours to run</h2>
        <p>
          A quiet bonus: the whole scheduling engine is open source, so you can self-host it and get
          every feature free, or use our cloud and let us handle the servers. Either way your
          calendar data stays yours — OAuth tokens are encrypted at rest, and we never sell what you
          put in.
        </p>

        <h2>Calendar-first, always</h2>
        <p>
          {BRAND.name} does one thing and does it deeply: it understands when you're actually free
          across every calendar you own, shares that cleanly, and lets people book you. The smart
          bits — AI suggestions, automations, adaptive availability — are confirm-first: they
          propose, you decide. We never silently rearrange your day.
        </p>

        <hr />
        <p>
          <em>Made for people who value their time.</em>
        </p>
      </Prose>
    </>
  );
}
