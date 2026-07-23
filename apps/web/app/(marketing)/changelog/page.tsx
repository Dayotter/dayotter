import { MarketingHeader } from "@/components/marketing/page-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  alternates: { canonical: "/changelog" },
  description: "What's new in DayOtter.",
};

const ENTRIES = [
  {
    date: "July 2026",
    title: "DayOtter for Android is live on Google Play",
    items: [
      "The Android app is now on Google Play - the full host workflow in your pocket, with push reminders and voice input for Otter. iOS is on the way.",
      "Import from Calendly: bring your event types and weekly availability across in one step.",
      "Opt-in bookings: require your approval before a request is confirmed.",
      "Offset start times: shift a booking type's slots off the hour (e.g. :05 / :35).",
    ],
  },
  {
    date: "July 2026",
    title: "Ask Otter, a refreshed interface & new sign-in",
    items: [
      "Ask Otter: a conversational assistant in your dashboard - by chat or voice - that reads your schedule and can act on your whole setup (bookings, booking types, availability, focus time, preferences, teams, reminder channels, automations). Always confirm-first; deletes ask twice.",
      "A refreshed, premium interface end to end - a cleaner typeface, in-theme dialogs and toasts, and a tidier mobile navigation.",
      "Phone number + one-time-code sign-in, email verification, and self-serve account deletion.",
      "Browser (web push) reminders alongside mobile push, Slack, SMS, and WhatsApp.",
    ],
  },
  {
    date: "July 2026",
    title: "Billing, editions & the developer platform",
    items: [
      "Open-core editions: self-host free, cloud $9/seat Pro.",
      "Public REST API (v1) with API keys, plus outbound webhooks with delivery history & replay.",
      "Booking analytics: view→booking funnel, conversion, revenue, and CSV export.",
      "Meeting lifecycle: auto-complete, no-show tracking, and post-meeting follow-ups.",
    ],
  },
  {
    date: "July 2026",
    title: "Intelligence & automation",
    items: [
      "AI scheduling and a natural-language command bar (confirm-first).",
      "Automation rules, recurring focus blocks, and travel-aware scheduling.",
      "Adaptive availability and deep-work defense.",
    ],
  },
  {
    date: "July 2026",
    title: "Mobile & foundations",
    items: [
      "Native iOS/Android app: bookings, event types, availability, insights, push.",
      "Unified calendar event model and the Calendar Inbox.",
      "Multi-channel reminders - Slack, WhatsApp, SMS, and push.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <MarketingHeader
        eyebrow="Changelog"
        title="What's new"
        subtitle="We ship fast. Here's the recent work."
      />
      <section className="mx-auto max-w-3xl px-6 py-16">
        <ol className="relative space-y-10 border-l border-[var(--color-border)] pl-6">
          {ENTRIES.map((e) => (
            <li key={e.title} className="relative">
              <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-[var(--color-bg)] bg-[var(--color-accent)]" />
              <p className="eyebrow">{e.date}</p>
              <h2 className="mt-1 text-lg font-semibold">{e.title}</h2>
              <ul className="mt-3 space-y-1.5 text-sm text-[var(--color-muted)]">
                {e.items.map((it) => (
                  <li key={it} className="flex gap-2">
                    <span className="text-[var(--color-accent)]">·</span>
                    {it}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
