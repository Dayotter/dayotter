/** Local documentation content. Add a guide here and it appears on /docs +
 *  /docs/[slug]. Keep it task-oriented — what a person does, not how the code works. */

export interface DocBlock {
  heading?: string;
  paragraphs?: string[];
  /** Rendered as an ordered list (numbered steps). */
  steps?: string[];
  /** Rendered as an unordered list. */
  bullets?: string[];
}

export type DocCategory = "Get started" | "Features" | "Advanced";

export interface DocGuide {
  slug: string;
  title: string;
  summary: string;
  category: DocCategory;
  readMinutes: number;
  body: DocBlock[];
}

export const GUIDES: DocGuide[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "From sign-up to a shareable booking link in about five minutes.",
    category: "Get started",
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          "DayOtter turns your calendars into a link people can book. Here's the whole path, start to finish.",
        ],
      },
      {
        heading: "The five-minute setup",
        steps: [
          "Create your account at /sign-up (email, Google, or phone).",
          "Connect a calendar so DayOtter knows when you're busy — Settings → Calendars.",
          "Set the hours you're open under Availability.",
          "Create a booking type (e.g. a 30-minute intro) under Booking Types.",
          "Copy your booking link from the dashboard and share it.",
        ],
      },
      {
        heading: "What happens when someone books",
        paragraphs: [
          "They open your link, see only the times you're genuinely free, and pick one. The meeting lands on your connected calendar with a video link attached, and both of you get a confirmation and reminders. No back-and-forth, no double-booking.",
        ],
      },
      {
        heading: "Next steps",
        bullets: [
          "Add reminder channels so nudges reach you where you are.",
          "Protect focus time with buffers, daily limits, and focus blocks.",
          "Invite teammates and share availability as a team.",
        ],
      },
    ],
  },
  {
    slug: "connect-a-calendar",
    title: "Connect a calendar",
    summary:
      "Link Google, Outlook, iCloud, or any feed so you're never offered a time you're busy.",
    category: "Get started",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "DayOtter never invents availability — it reads your real calendars. Connect every calendar that holds commitments so a booking can't land on top of one.",
        ],
      },
      {
        heading: "Supported calendars",
        bullets: [
          "Google Calendar and Microsoft 365 / Outlook (one-click OAuth).",
          "Apple iCloud (with an app-specific password).",
          "Any read-only ICS / webcal feed, for calendars you can only subscribe to.",
        ],
      },
      {
        heading: "Connect one",
        steps: [
          "Go to Settings → Calendars.",
          "Pick your provider and approve access.",
          "Choose which of that account's calendars DayOtter should check for conflicts.",
        ],
      },
      {
        heading: "Busy, not private",
        paragraphs: [
          "DayOtter only sees that you're busy, never the details of your events. You also choose exactly which calendar new bookings are written to — keep the rest read-only, just for conflict checks. Connection tokens are encrypted at rest.",
        ],
      },
    ],
  },
  {
    slug: "create-a-booking-type",
    title: "Create a booking type",
    summary: "One booking type per kind of meeting — shaped exactly how you work.",
    category: "Features",
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          "A booking type is a shareable meeting template: its length, where it happens, and the rules around it. Make one for each kind of meeting you take.",
        ],
      },
      {
        heading: "The essentials",
        bullets: [
          "Title, URL slug, and duration (offer several lengths if you like).",
          "Location: Google Meet, Zoom, Microsoft Teams, phone, or in person.",
          "Buffers before and after, and a minimum notice so nobody books you in five minutes.",
          "Daily and weekly limits to cap how much you take on.",
          "Intake questions so you show up prepared.",
        ],
      },
      {
        heading: "Private and one-off links",
        paragraphs: [
          "Mark a type private to keep it off your public page and share it only with the people you choose. Or generate a one-off link for a single meeting that expires once it's used — handy when you don't want to expose your whole calendar.",
        ],
      },
      {
        heading: "Paid bookings",
        paragraphs: [
          "Connect Stripe and set a price to take payment at booking time — useful for consultations or paid sessions. Free types stay free.",
        ],
      },
    ],
  },
  {
    slug: "set-your-availability",
    title: "Set your availability",
    summary:
      "Weekly hours, date exceptions, multiple schedules, and defenses that protect your time.",
    category: "Features",
    readMinutes: 4,
    body: [
      {
        heading: "Weekly hours",
        paragraphs: [
          "Under Availability, set the hours you're open on each day. Add multiple ranges per day (say, a morning and an afternoon block), then Save. These are the times DayOtter will ever offer.",
        ],
      },
      {
        heading: "Date overrides and schedules",
        paragraphs: [
          "Override specific dates — a day off, a one-time early start. Running different offerings? Create multiple named schedules (e.g. “Consulting hours”) and assign each booking type to the right one.",
        ],
      },
      {
        heading: "Defenses that hold",
        bullets: [
          "Focus blocks: reserve deep-work time that's off-limits to bookings.",
          "Adaptive availability: cap meetings per day; once a day is full, it stops offering slots.",
          "Travel buffers: reserve time around in-person meetings automatically.",
          "A protected lunch that never gets booked over.",
        ],
      },
    ],
  },
  {
    slug: "reminders-and-notifications",
    title: "Reminders & notifications",
    summary: "Reach people where they already are, so meetings don't get missed.",
    category: "Features",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "The best reminder is the one someone actually reads. Email reminders are always on; add more channels on top for you and your attendees.",
        ],
      },
      {
        heading: "Channels",
        bullets: [
          "Slack, SMS, WhatsApp, mobile push, and browser (web) push.",
          "Add and verify each under Settings → Notifications — DayOtter sends a test to confirm it works.",
        ],
      },
      {
        heading: "Timing",
        paragraphs: [
          "Choose the lead times that fit you — a day before to plan, an hour before to get moving. Every new booking inherits them, so you set it once.",
        ],
      },
    ],
  },
  {
    slug: "team-scheduling",
    title: "Team scheduling",
    summary: "Round-robin, collective availability, and shared team rules — from one link.",
    category: "Features",
    readMinutes: 3,
    body: [
      {
        heading: "Create a team",
        steps: [
          "Go to Teams and create a team.",
          "Add members by email (they need a DayOtter account).",
          "Create a team booking type and pick how it schedules.",
        ],
      },
      {
        heading: "Collective vs round-robin",
        paragraphs: [
          "A collective type finds a slot when everyone required is free. A round-robin type spreads incoming bookings across the team so no one carries them all. Either way it's a single link — DayOtter picks the right host and time.",
        ],
      },
      {
        heading: "Shared view and rules",
        paragraphs: [
          "See the whole team's free/busy for the week in one place, and set team rules — holidays, no-meeting windows — that every member's links respect.",
        ],
      },
    ],
  },
  {
    slug: "the-otter-assistant",
    title: "Ask Otter (the AI assistant)",
    summary: "Chat or talk to your calendar — it drafts every change and never acts without a tap.",
    category: "Advanced",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "Otter is the assistant on your dashboard. Ask it in plain language — by typing or by voice — and it reads your real availability to get things done.",
        ],
      },
      {
        heading: "What you can ask",
        bullets: [
          "“Move my 3pm to Friday morning.”",
          "“Find me a free hour this week for deep work.”",
          "“Create a 20-minute intro call booking type.”",
          "“Turn off SMS reminders.”",
        ],
      },
      {
        heading: "Confirm-first, always",
        paragraphs: [
          "Otter can create booking types, hold focus time, change your availability and preferences, manage reminder channels, and more — but it only ever proposes. Every change is an editable card you approve, and anything destructive asks twice.",
        ],
      },
      {
        heading: "Turning it on",
        paragraphs: [
          "On the cloud, Otter is ready when you sign in. Self-hosting? Add your own ANTHROPIC_API_KEY and it turns on.",
        ],
      },
    ],
  },
];

export function getGuide(slug: string): DocGuide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export const DOC_CATEGORIES: DocCategory[] = ["Get started", "Features", "Advanced"];
