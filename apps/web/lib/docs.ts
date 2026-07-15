/** Local documentation content. Add a guide here and it appears on /docs +
 *  /docs/[slug]. Task-oriented - what a person does, and the details that
 *  actually trip people up, not how the code works. */

export interface DocBlock {
  heading?: string;
  paragraphs?: string[];
  /** Rendered as an ordered list (numbered steps). */
  steps?: string[];
  /** Rendered as an unordered list. */
  bullets?: string[];
  /** A highlighted callout aside. */
  tip?: { kind?: "tip" | "note" | "warning"; text: string };
}

export type DocCategory =
  | "Get started"
  | "Scheduling"
  | "Teams"
  | "AI & automation"
  | "Payments"
  | "Build & self-host";

export interface DocGuide {
  slug: string;
  title: string;
  summary: string;
  category: DocCategory;
  readMinutes: number;
  body: DocBlock[];
  /** Slugs of closely related guides, shown at the foot of the page. */
  related?: string[];
}

export const GUIDES: DocGuide[] = [
  // ─── Get started ──────────────────────────────────────────────────────────
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "From sign-up to a booking link people can use - in about five minutes.",
    category: "Get started",
    readMinutes: 6,
    related: ["connect-a-calendar", "create-a-booking-type", "your-booking-page"],
    body: [
      {
        paragraphs: [
          "DayOtter turns the calendars you already keep into a link other people can book - without the email tennis, the double-bookings, or the timezone math. This guide walks the whole path once, so you know where everything lives before you go deeper on any one piece.",
          "There are two ways to use DayOtter, and you can mix them freely: share a link and let people book themselves, or just tell Otter (the built-in assistant) what you want and approve the draft. Nothing here requires the AI - it's there when you want it.",
        ],
      },
      {
        heading: "The five-minute setup",
        steps: [
          "Create your account at /sign-up with email, Google, or your phone number.",
          "Connect a calendar (Settings → Calendars) so DayOtter can see when you're already busy. This is what prevents double-bookings.",
          "Set the hours you're open under Availability - the only times DayOtter will ever offer.",
          "Create a booking type under Booking Types - say, a 30-minute intro call - with its length, location, and any questions you want answered up front.",
          "Copy your booking link from the dashboard and share it, or add it to your email signature and website.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "In a hurry? After connecting a calendar, open Ask Otter and say “create a 30-minute intro call.” It drafts the booking type for you - review it and tap Confirm.",
        },
      },
      {
        heading: "What happens when someone books",
        paragraphs: [
          "They open your link and see only the times you're genuinely free - computed against every calendar you connected, in their own timezone. They pick a slot, answer any intake questions, and confirm.",
          "The meeting is written to your calendar with a video link attached (Google Meet, Zoom, or Teams, depending on the booking type). Both of you get a confirmation email, and reminders go out automatically before it starts. If you take payment, they pay at this step and the slot is held only once payment clears.",
        ],
      },
      {
        heading: "Find your way around",
        bullets: [
          "Home - today and this week at a glance, plus Otter and “Otter noticed” suggestions.",
          "Booking Types - the meeting templates people book from.",
          "Availability - weekly hours, date overrides, and the defenses that protect your time.",
          "Bookings - everything scheduled: reschedule, cancel, or mark a no-show.",
          "Teams, Routing, Polls - the group tools (all free to self-host, no paywall).",
          "Insights - where your time actually goes, and your booking funnel.",
          "Settings - calendars, notifications, payments, CRM, billing, and the developer tools.",
        ],
      },
      {
        heading: "Sensible next steps",
        bullets: [
          "Add reminder channels (Slack, SMS, WhatsApp, push) so nudges reach you where you already are.",
          "Protect focus time with buffers, daily limits, and focus blocks so meetings don't eat the day.",
          "Brand your public page with a colour, a welcome message, and your logo.",
          "Invite teammates and share availability if you schedule as a group.",
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
    readMinutes: 5,
    related: ["set-your-availability", "getting-started", "create-a-booking-type"],
    body: [
      {
        paragraphs: [
          "DayOtter never invents availability - it reads your real calendars. Connecting every calendar that holds commitments is the single most important setup step: it's what guarantees a booking can never land on top of something you've already got.",
          "A connection does two jobs: it reads your busy times (so conflicts are respected) and it can write new bookings back (so meetings show up where you actually look). You control which calendar each new booking is written to, and which calendars only count for conflicts.",
        ],
      },
      {
        heading: "Supported calendars",
        bullets: [
          "Google Calendar - one-click OAuth. Real-time sync via Google's push channels.",
          "Microsoft 365 / Outlook - one-click OAuth via Microsoft Graph, also real-time.",
          "Apple iCloud - connect over CalDAV using an app-specific password (not your Apple ID password).",
          "Any ICS / webcal feed - read-only subscriptions, for calendars you can't OAuth into (a shared team calendar, a sports schedule, a partner's feed).",
        ],
      },
      {
        heading: "Connect one",
        steps: [
          "Go to Settings → Calendars.",
          "Pick your provider and approve access. For Apple, generate an app-specific password at appleid.apple.com first, then paste it in.",
          "Choose which of that account's calendars DayOtter should check for conflicts - tick every calendar that represents real commitments.",
          "Pick the target calendar new bookings are written to (usually your main work calendar).",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "Connect more than one account if your life is split across them - a work Google and a personal iCloud, say. DayOtter merges them into one honest view of when you're free, so a dentist appointment in your personal calendar still blocks a work slot.",
        },
      },
      {
        heading: "Busy, not private",
        paragraphs: [
          "DayOtter only reads that you're busy at a given time - never the titles, attendees, or notes of your events. The calendars you mark read-only are used purely for conflict checks and are never written to.",
          "Connection tokens are encrypted at rest (AES-256-GCM). You can disconnect any account at any time from the same screen, which immediately stops all reading and writing for it.",
        ],
      },
      {
        heading: "If availability looks wrong",
        bullets: [
          "A slot you expected to be blocked is offered → the conflicting event lives in a calendar you didn't tick for conflict-checking. Add it under Settings → Calendars.",
          "Bookings aren't appearing in your calendar → check which account is set as the write target, and that DayOtter still has access (re-approve if you changed your password).",
          "Apple stopped syncing → app-specific passwords can be revoked from your Apple ID; generate a new one and reconnect.",
        ],
      },
    ],
  },
  {
    slug: "your-booking-page",
    title: "Your booking page & profile",
    summary: "Brand the public page people land on, and choose exactly what they see.",
    category: "Get started",
    readMinutes: 4,
    related: ["create-a-booking-type", "getting-started"],
    body: [
      {
        paragraphs: [
          "Your public page is where invitees land - at dayotter.com/your-handle (or your own domain on Pro). It lists the booking types you've made public, styled the way you set it. It's the first impression, so it's worth a couple of minutes.",
        ],
      },
      {
        heading: "Make it yours",
        bullets: [
          "Handle - the /your-handle part of the URL. Pick something short and recognisable under Settings → Profile.",
          "Accent colour - themes buttons and highlights on your public pages to match your brand.",
          "Welcome message - a short line of context shown at the top of your page (“Book time with me - I usually reply within a day”).",
          "Avatar and display name - the face and name people see.",
        ],
      },
      {
        heading: "Control what's listed",
        paragraphs: [
          "Only booking types marked public appear on your page. Keep internal or paid types private and share their direct links with just the people who need them. Reorder types so your most important one is first.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "For a single high-stakes meeting - a candidate, a big prospect - generate a one-off link from the booking type instead of sharing your whole page. It works once and then expires, so your full calendar stays private.",
        },
      },
    ],
  },

  // ─── Scheduling ───────────────────────────────────────────────────────────
  {
    slug: "create-a-booking-type",
    title: "Create a booking type",
    summary: "One template per kind of meeting - shaped exactly how you work.",
    category: "Scheduling",
    readMinutes: 6,
    related: ["set-your-availability", "your-booking-page", "payments-and-packages"],
    body: [
      {
        paragraphs: [
          "A booking type is a reusable meeting template: how long it runs, where it happens, and every rule around it. Make one for each distinct kind of meeting you take - a quick intro, a paid consult, a recurring coaching session - and share whichever links you like.",
        ],
      },
      {
        heading: "The essentials",
        bullets: [
          "Title and URL slug - what people see, and the /handle/slug link.",
          "Duration - a single length, or several the invitee can choose from (15 / 30 / 60).",
          "Location - Google Meet, Zoom, Microsoft Teams, phone, in person, or a custom link. Video links are generated per booking automatically when the provider is connected.",
          "Description - what the meeting is for; shown on the booking page.",
        ],
      },
      {
        heading: "Guardrails that protect your day",
        bullets: [
          "Buffers - reserve a few minutes before and/or after so meetings never stack edge-to-edge.",
          "Minimum notice - the shortest lead time you'll accept, so nobody books you in five minutes.",
          "Daily / weekly limits - cap how many of this type you'll take (e.g. max 4 demos a day).",
          "Date range - only allow bookings within a rolling window (e.g. the next 30 days).",
        ],
      },
      {
        heading: "Intake questions",
        paragraphs: [
          "Add questions invitees answer when they book - short text, long text, multiple choice, or required/optional. Answers arrive with the booking so you show up prepared, and they can also drive routing (send different answers to different people). Ask only what you'll actually use.",
        ],
      },
      {
        heading: "Recurring, private, and one-off",
        bullets: [
          "Recurring - offer a weekly, biweekly, or monthly series; one confirmation books the whole run.",
          "Private - keep the type off your public page and share its direct link only.",
          "One-off link - a single-use link that expires after it's booked, for a single meeting.",
          "Group - let several people book the same slot up to a capacity (a webinar, office hours).",
        ],
      },
      {
        heading: "Paid bookings",
        paragraphs: [
          "Connect Stripe and set a price (or a deposit) to take payment at booking time. The slot is held only once payment succeeds. Free types stay free. See Payments & packages for the full flow, including selling prepaid session bundles.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Start with one booking type and share it. It's tempting to model every scenario up front, but you'll learn what you actually need faster by shipping one link and iterating.",
        },
      },
    ],
  },
  {
    slug: "set-your-availability",
    title: "Set your availability",
    summary: "Weekly hours, date exceptions, multiple schedules, and defenses that hold.",
    category: "Scheduling",
    readMinutes: 6,
    related: ["create-a-booking-type", "connect-a-calendar", "manage-bookings"],
    body: [
      {
        paragraphs: [
          "Availability is the outer boundary of when you'll ever be offered. DayOtter then subtracts your real calendar busy times from inside those hours, so what invitees see is the intersection: open hours, minus everything you've already got on.",
        ],
      },
      {
        heading: "Weekly hours",
        paragraphs: [
          "Under Availability, set the hours you're open each day. Add multiple ranges per day - a morning and an afternoon block with lunch in between - and save. Set your schedule's timezone once; invitees always see times converted to their own, and DST is handled for you.",
        ],
      },
      {
        heading: "Date overrides and multiple schedules",
        paragraphs: [
          "Override specific dates for a day off, a conference, or a one-time early start - without touching your normal weekly pattern.",
          "Running distinct offerings? Create multiple named schedules (say, “Consulting hours” and “Office hours”) and assign each booking type to the right one. A demo can run 9-5 weekdays while coaching runs Tuesday evenings, from the same account.",
        ],
      },
      {
        heading: "Defenses that hold",
        bullets: [
          "Focus blocks - reserve deep-work time that's off-limits to bookings. Ask Otter to find and hold them for you.",
          "Adaptive availability - cap meetings per day; once a day hits the cap, DayOtter stops offering slots that day even if hours remain.",
          "Travel buffers - automatically reserve time around in-person meetings so back-to-back locations don't collide.",
          "Protected lunch - a daily window that never gets booked over.",
          "Reclaim cancelled time - when a meeting is cancelled, optionally turn the freed slot into a focus block instead of re-opening it.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "Buffers and minimum notice can be set per booking type too. Availability sets your overall boundary; the booking type fine-tunes it for that specific meeting.",
        },
      },
    ],
  },
  {
    slug: "manage-bookings",
    title: "Manage & reschedule bookings",
    summary: "Reschedule, cancel, handle no-shows, and let Otter do the shuffle.",
    category: "Scheduling",
    readMinutes: 4,
    related: ["set-your-availability", "reminders-and-notifications", "the-otter-assistant"],
    body: [
      {
        paragraphs: [
          "Every scheduled meeting lives under Bookings. From there you (and your invitees, from their confirmation email) can move or cancel it - and the right people are always notified automatically.",
        ],
      },
      {
        heading: "Reschedule",
        paragraphs: [
          "Open a booking and pick a new time from your live availability, or ask Otter (“move my 3pm with Dana to Thursday afternoon”). The calendar event updates in place, the video link is preserved, attendees are notified, and reminders re-schedule to the new time. No new thread, no duplicate event.",
        ],
      },
      {
        heading: "Cancel",
        paragraphs: [
          "Cancelling notifies attendees, removes the event from your calendar, and clears its pending reminders. If you took payment, you can refund at the same time. If you've enabled reclaim-cancelled-time, the freed slot becomes a focus block instead of re-opening for booking.",
        ],
      },
      {
        heading: "No-shows and recurring series",
        bullets: [
          "Mark a no-show - past meetings auto-complete; flag the ones that didn't happen so your analytics stay honest and you can send a warm rebook nudge.",
          "Recurring series - manage the whole run together, or a single occurrence, from the booking.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Turn on the running-late nudge (Settings → Preferences). If a meeting runs over, Otter quietly messages your next attendee that you're a few minutes out - no awkward apology needed.",
        },
      },
    ],
  },
  {
    slug: "reminders-and-notifications",
    title: "Reminders & notifications",
    summary: "Reach people where they already are, so meetings don't get missed.",
    category: "Scheduling",
    readMinutes: 4,
    related: ["manage-bookings", "workflows-and-automations", "voice-and-messaging"],
    body: [
      {
        paragraphs: [
          "The best reminder is the one someone actually reads. Email reminders are always on for both sides; layer on more channels for yourself, and set the lead times that fit how you work.",
        ],
      },
      {
        heading: "Channels",
        bullets: [
          "Slack - reminders and Otter's nudges in a channel or DM, via an incoming webhook.",
          "SMS and WhatsApp - text reminders (and two-way “talk to Otter” messaging) via Twilio.",
          "Mobile push - through the DayOtter app.",
          "Browser (web) push - desktop reminders even when the tab is closed.",
        ],
      },
      {
        heading: "Set them up",
        steps: [
          "Go to Settings → Notifications.",
          "Add a channel and enter its destination (Slack webhook URL, phone number, etc.).",
          "DayOtter sends a test so you can confirm it works before relying on it.",
          "Choose default lead times - e.g. a day before to plan and an hour before to get moving.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "Lead times are a default every new booking inherits, so you set them once. A single booking type can override them if it needs different timing.",
        },
      },
      {
        heading: "Beyond reminders",
        paragraphs: [
          "For richer sequences - a follow-up after the meeting, a no-show rebook nudge, a prep note the morning of - use Workflows. And turn on the daily morning briefing to get a calm summary of your day before it starts.",
        ],
      },
    ],
  },

  // ─── Teams ────────────────────────────────────────────────────────────────
  {
    slug: "team-scheduling",
    title: "Team scheduling",
    summary: "Round-robin, collective availability, and shared team rules - from one link.",
    category: "Teams",
    readMinutes: 5,
    related: ["routing-forms", "group-polls", "create-a-booking-type"],
    body: [
      {
        paragraphs: [
          "Teams let several people share a single booking link. DayOtter picks the right host and time based on how you've set the team up - so no one carries all the meetings, and invitees never see the machinery.",
        ],
      },
      {
        heading: "Create a team",
        steps: [
          "Go to Teams and create a team.",
          "Add members by email (they receive an invitation; they'll need a DayOtter account to host).",
          "Give each member a weight - higher gets booked more often; set 0 to pause someone who's away.",
          "Create a team booking type and choose how it schedules.",
        ],
      },
      {
        heading: "Collective vs round-robin",
        bullets: [
          "Collective - offers only slots where everyone required is free at once. For panels, group calls, and reviews.",
          "Round-robin - spreads incoming bookings across the team, weighted and load-balanced, only ever to a host who's genuinely free at that time. For demos, support, and first-round screens.",
        ],
      },
      {
        heading: "Shared view and working agreements",
        paragraphs: [
          "See the whole team's free/busy for the week in one place. Set team rules - company holidays, no-meeting windows like Focus Fridays - that every member's links respect automatically, in each member's own timezone.",
        ],
      },
      {
        heading: "Team briefings",
        paragraphs: [
          "Turn on a daily team briefing (admins only, on the team page) for a shared morning digest: total meetings today, load per member, who's busiest, and focus time held - delivered over email and your channels.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "Weighted round-robin, routing, collective booking, and polls are all in the open core - free to self-host, with no per-seat paywall.",
        },
      },
    ],
  },
  {
    slug: "routing-forms",
    title: "Routing forms",
    summary: "Ask a couple of questions, then send each visitor to the right person or meeting.",
    category: "Teams",
    readMinutes: 4,
    related: ["team-scheduling", "create-a-booking-type"],
    body: [
      {
        paragraphs: [
          "A routing form sits in front of your booking pages. It asks a question or two, then applies simple rules to decide where the visitor goes - a specific person, a team, or a particular booking type. Enterprise leads reach a senior rep; support questions reach the right queue; the wrong person never fields the wrong meeting.",
        ],
      },
      {
        heading: "Build one",
        steps: [
          "Go to Routing and create a form.",
          "Add the questions that determine routing (company size, product interest, issue type).",
          "Write rules, checked top to bottom: “if Company size is Enterprise → senior AE round-robin.”",
          "Set a fallback destination for anything that doesn't match a rule.",
          "Share the form's link where inbound lands - your site, an ad, an email.",
        ],
      },
      {
        heading: "For sales: qualify and book instantly",
        paragraphs: [
          "Routing doubles as lead qualification. A scored lead drops straight onto the right rep's live availability - no reply-and-wait gap where interest cools. Combine it with weighted round-robin behind the rule to favour your best closers and pause anyone who's out.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Keep the form to one or two questions. Every extra field costs you conversions; ask only what genuinely changes where the booking should go.",
        },
      },
    ],
  },
  {
    slug: "group-polls",
    title: "Group polls",
    summary: "Propose a few times, let people vote, lock in the winner as a real booking.",
    category: "Teams",
    readMinutes: 3,
    related: ["team-scheduling", "manage-bookings"],
    body: [
      {
        paragraphs: [
          "When you can't pin everyone to a fixed collective slot - a panel, a committee, a group dinner - a poll finds the time the most people can make. Propose candidate times, share the link, and let each invitee mark what works.",
        ],
      },
      {
        heading: "Run a poll",
        steps: [
          "Go to Polls and create one; add a handful of candidate times.",
          "Share the link with everyone who needs to attend.",
          "Watch votes come in - each person ticks the slots that work for them.",
          "Finalise the most-supported slot; it becomes a real booking with invites and reminders attached.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "Unlike a bare poll tool, finalising a DayOtter poll creates the actual calendar event for everyone and sends reminders - there's no separate “now go book it” step, and no ads on your invitees.",
        },
      },
    ],
  },

  // ─── AI & automation ──────────────────────────────────────────────────────
  {
    slug: "the-otter-assistant",
    title: "Ask Otter (the AI assistant)",
    summary: "Chat or talk to your calendar - it drafts every change and never acts without a tap.",
    category: "AI & automation",
    readMinutes: 5,
    related: ["voice-and-messaging", "workflows-and-automations", "manage-bookings"],
    body: [
      {
        paragraphs: [
          "Otter is the assistant built into your dashboard. Ask it in plain language - typing or by voice - and it reads your real availability and bookings to get things done. It's an executive assistant for your calendar, not a chatbot bolted onto a link.",
        ],
      },
      {
        heading: "What you can ask",
        bullets: [
          "“What's next on my calendar?” / “How busy am I Thursday?”",
          "“Book 30 minutes with Priya Thursday afternoon.”",
          "“Find me a free two-hour block this week for deep work and hold it.”",
          "“Move my 3pm to Friday morning.”",
          "“Create a 20-minute intro-call booking type.”",
          "“Turn off SMS reminders.”",
        ],
      },
      {
        heading: "Confirm-first, always",
        paragraphs: [
          "Otter can create booking types, hold focus time, book/reschedule/cancel meetings, change availability and preferences, manage reminder channels, and more - but it only ever proposes. Every change is an editable card you approve, and anything destructive (like a cancel or delete) asks a second time. Nothing lands on your calendar without your explicit OK.",
        ],
      },
      {
        heading: "Hands-free voice mode",
        paragraphs: [
          "Open Ask Otter and it starts in voice mode by default: tap the orb and talk, and Otter listens, thinks, and speaks its reply, then listens again. Confirm a proposed change by tapping Confirm or simply saying “confirm.” Prefer typing? Switch to text chat from the same panel.",
        ],
      },
      {
        heading: "It learns your patterns",
        paragraphs: [
          "Over time Otter builds a private memory of how you work - your typical meeting length, who you meet most, your busiest days, the hours you actually keep - and uses it to make sharper suggestions. It's your data, used to help you; you can see and clear it.",
        ],
      },
      {
        heading: "Turning it on",
        paragraphs: [
          "On the DayOtter cloud, Otter is ready the moment you sign in. Self-hosting? Add your own ANTHROPIC_API_KEY to the environment and it turns on - no metered per-use cost, it's your key.",
        ],
      },
    ],
  },
  {
    slug: "voice-and-messaging",
    title: "Voice & messaging (WhatsApp, SMS, receptionist)",
    summary: "Talk to Otter, text it, or let it answer the phone and book for you.",
    category: "AI & automation",
    readMinutes: 4,
    related: ["the-otter-assistant", "reminders-and-notifications"],
    body: [
      {
        paragraphs: [
          "Otter isn't only in the app. It reaches you (and your callers) over voice, WhatsApp, and SMS - all confirm-first, all optional, all off until you configure the channel.",
        ],
      },
      {
        heading: "Talk to Otter over WhatsApp / SMS",
        paragraphs: [
          "With Twilio connected, text the number in your settings to ask Otter to book, move, or check meetings from your phone's messaging app. It replies with a draft; reply YES to confirm. Great for capturing a scheduling thought the moment you have it.",
        ],
      },
      {
        heading: "The AI voice receptionist",
        paragraphs: [
          "Point a Twilio phone number's voice webhook at DayOtter and Otter can answer calls for one host - understand what the caller needs, answer from a knowledge source you provide, and hand them a booking link (or text it) to lock in a time. Set VOICE_RECEPTIONIST_HANDLE to the host it answers for.",
        ],
      },
      {
        tip: {
          kind: "warning",
          text: "Inbound webhooks are verified with Twilio's signature and fail closed, so only genuine Twilio requests are processed. Register your webhooks at ${APP_URL}/api/webhooks/twilio (messaging) and .../voice (voice).",
        },
      },
    ],
  },
  {
    slug: "workflows-and-automations",
    title: "Workflows & automations",
    summary: "Automatic messages and calendar actions that fire around your meetings.",
    category: "AI & automation",
    readMinutes: 4,
    related: ["reminders-and-notifications", "manage-bookings"],
    body: [
      {
        paragraphs: [
          "Workflows send the right message at the right moment without you lifting a finger. Automations take actions on your calendar when a booking matches a rule. Together they turn “I should really follow up / block prep time” into something that just happens.",
        ],
      },
      {
        heading: "Attendee workflows",
        bullets: [
          "Reminders - before the meeting, on the channels you choose.",
          "Follow-ups - a thank-you and rebook link after it ends.",
          "No-show nudges - a warm “sorry we missed you, grab another time” for missed meetings.",
          "Custom messages - your own copy, with variables like the attendee's name, the time, and the join link.",
        ],
      },
      {
        heading: "Calendar automations",
        paragraphs: [
          "Write rules like “every interview → hold a 15-minute prep block before it,” or “every in-person meeting → reserve travel time around it.” When a booking matches, DayOtter creates the time block automatically. Recurring weekly blocks are materialised ahead of time so they're always there.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Not sure where to start? Ask Otter - “remind attendees a day before and follow up after” - and it drafts the workflow for you to confirm.",
        },
      },
    ],
  },
  {
    slug: "insights",
    title: "Insights & where your time goes",
    summary: "See your meeting load, your booking funnel, and how your week actually splits.",
    category: "AI & automation",
    readMinutes: 3,
    related: ["set-your-availability", "the-otter-assistant"],
    body: [
      {
        paragraphs: [
          "Insights answers two different questions: how well your booking pages convert, and where your time actually goes once meetings are on the calendar.",
        ],
      },
      {
        heading: "Booking analytics",
        paragraphs: [
          "Track views, starts, and completed bookings per type - your funnel - plus totals over time. If a page gets views but few bookings, that's a signal to simplify its intake questions or widen its availability.",
        ],
      },
      {
        heading: "Where your time goes",
        bullets: [
          "Meetings vs. focus - the core balance of your week.",
          "Who you spend the most time with, and external-vs-internal (by email domain).",
          "When in the day your meetings land, and your back-to-back share.",
          "Your longest focus streak, recurring vs one-off load, and time reclaimed from cancellations.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "These metrics need a little history to be meaningful - they read your last 30 days of bookings and focus blocks. Give it a couple of weeks of real use before drawing conclusions.",
        },
      },
    ],
  },

  // ─── Payments ─────────────────────────────────────────────────────────────
  {
    slug: "payments-and-packages",
    title: "Payments & prepaid packages",
    summary: "Charge to book, take deposits, and sell bundles of sessions - via Stripe.",
    category: "Payments",
    readMinutes: 4,
    related: ["create-a-booking-type", "manage-bookings"],
    body: [
      {
        paragraphs: [
          "Connect Stripe and any booking type can require payment - the full price or a deposit - before the slot is held. It's ideal for consultations, coaching, lessons, and anything where your time is the product. Free types stay free.",
        ],
      },
      {
        heading: "Take payment to book",
        steps: [
          "Connect Stripe under Settings → Payments (or the Billing area).",
          "Open a booking type and set a price, or a deposit amount.",
          "Share the link - invitees pay at checkout, and the slot is confirmed only once payment succeeds.",
        ],
      },
      {
        heading: "Prepaid session packages",
        paragraphs: [
          "Sell a bundle up front - ten lessons, a block of coaching hours - and the client draws down one credit per booking. They pay once, receive a credit balance, and book as they go. You can also grant credits manually (a comped session, a referral). Balances are tracked atomically, so they never go wrong.",
        ],
      },
      {
        heading: "Refunds and no-shows",
        bullets: [
          "Cancelling a paid booking can refund it in the same step.",
          "Deposits are a gentle middle ground - enough commitment to deter no-shows without charging the full fee.",
        ],
      },
      {
        tip: {
          kind: "note",
          text: "On the DayOtter cloud, accepting payments is part of Pro. Self-hosting? It's free - you just bring your own Stripe keys.",
        },
      },
    ],
  },

  // ─── Build & self-host ────────────────────────────────────────────────────
  {
    slug: "crm-sync",
    title: "CRM sync (Salesforce & HubSpot)",
    summary: "Log every booking to your CRM automatically - contact plus meeting activity.",
    category: "Build & self-host",
    readMinutes: 4,
    related: ["routing-forms", "developer-api"],
    body: [
      {
        paragraphs: [
          "Native CRM sync means every booking becomes a record in Salesforce or HubSpot without anyone typing it in. DayOtter finds or creates the guest as a contact and logs the meeting as an activity against them - updated when the booking moves, closed when it's cancelled.",
        ],
      },
      {
        heading: "Connect",
        steps: [
          "Register an OAuth app with your CRM (redirect: ${APP_URL}/api/integrations/crm/<provider>/callback).",
          "Set the provider's client id and secret in DayOtter's environment.",
          "Go to Settings → CRM and connect - one click, no keys to paste into DayOtter itself.",
        ],
      },
      {
        heading: "What gets synced",
        bullets: [
          "Contact - matched by email or created (no duplicates).",
          "Meeting - a Salesforce Event or a HubSpot meeting engagement, associated with the contact.",
          "On reschedule - the same activity is updated; on cancel, it's closed/removed.",
        ],
      },
      {
        tip: {
          kind: "warning",
          text: "CRM sync is currently in beta. Test it against a sandbox org before pointing it at production data, and watch Settings → CRM for the last-sync status.",
        },
      },
    ],
  },
  {
    slug: "developer-api",
    title: "Developer: API, webhooks & embed",
    summary: "Keys and REST endpoints, signed booking events, and the embeddable widget.",
    category: "Build & self-host",
    readMinutes: 5,
    related: ["crm-sync", "self-hosting"],
    body: [
      {
        paragraphs: [
          "DayOtter is API-first: everything the UI does, it does through the same endpoints you can call. Use the REST API to read and write bookings, event types, and availability; webhooks to react to events; and the embed widget to put booking on your own site.",
        ],
      },
      {
        heading: "API keys",
        steps: [
          "Go to Settings → Developer and create an API key.",
          "Send it as a bearer token: Authorization: Bearer <key>.",
          "Call the /api/v1 endpoints for bookings, event types, availability, and more.",
        ],
      },
      {
        heading: "Webhooks",
        paragraphs: [
          "Register an endpoint URL and subscribe to booking.created, booking.rescheduled, and booking.cancelled. Each delivery is signed with an HMAC-SHA-256 signature over a timestamped body (Stripe-style), so you can verify authenticity and reject replays. Deliveries retry with backoff and record their terminal status.",
        ],
      },
      {
        heading: "Embed",
        paragraphs: [
          "Drop the booking widget onto your own page so people book without leaving your site. The public booking pages are also just URLs, so you can link or iframe them anywhere.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Webhook consumer URLs are validated against internal IP ranges and pinned to the resolved public IP (defeating DNS-rebinding), and redirects aren't followed. Point them only at endpoints you control.",
        },
      },
    ],
  },
  {
    slug: "self-hosting",
    title: "Self-hosting DayOtter",
    summary: "Run the whole platform on your own infrastructure, with every feature unlocked.",
    category: "Build & self-host",
    readMinutes: 5,
    related: ["developer-api", "the-otter-assistant"],
    body: [
      {
        paragraphs: [
          "DayOtter's core is open-source (AGPLv3) and ships with Docker. Self-hosted, every Pro feature is free - teams, routing, AI, payments, CRM - because the paywall only exists on the hosted cloud. You bring the keys for the integrations you want; everything else just works.",
        ],
      },
      {
        heading: "Ways in",
        bullets: [
          "One-click on AWS - a CloudFormation template boots the full stack on a single instance.",
          "One command on any Ubuntu/Debian box - the installer sets up Docker, generates secrets, and starts everything.",
          "Manual - clone the repo and bring the compose stack up yourself.",
          "Behind your own nginx - publish the app on localhost and terminate TLS with your existing reverse proxy.",
        ],
      },
      {
        heading: "What runs",
        bullets: [
          "web - the Next.js app (booking pages, dashboard, API).",
          "worker - background jobs: reminders, calendar sync, webhooks, briefings, CRM sync.",
          "postgres and redis - the database and the queue/cache.",
          "A one-shot migrate step that applies database migrations on every deploy.",
        ],
      },
      {
        heading: "Turning on integrations",
        paragraphs: [
          "Everything except the calendar core is off until you add its keys: Google/Microsoft OAuth, an SMTP or Resend key for email, ANTHROPIC_API_KEY for Otter, Twilio for SMS/WhatsApp/voice, Stripe for payments, and the Salesforce/HubSpot client credentials for CRM. Each is inert (and hidden) until configured.",
        ],
      },
      {
        tip: {
          kind: "warning",
          text: "On redeploy, always run the migration step before the new app boots - the deploy script does this in order. Otherwise new code can start against an un-migrated database. See the deploy README for the exact sequence.",
        },
      },
    ],
  },
  {
    slug: "building-extensions",
    title: "Building extensions (plugins)",
    summary: "Add capabilities - notes, scribe, new connectors, Otter tools - without forking.",
    category: "Build & self-host",
    readMinutes: 6,
    related: ["developer-api", "the-otter-assistant", "self-hosting"],
    body: [
      {
        paragraphs: [
          "Some needs are too specific to live in the core - a note-taker wired to your wiki, a scribe that kicks off transcription, a connector to an internal tool. DayOtter's plugin system lets you add those as small, separate packages that work in tandem with the product, so you never fork the core to cover an edge case.",
          "A plugin is a package that default-exports `definePlugin({...})` and contributes capabilities. It's built against `@dayotter/plugin-sdk`, which has no dependency on DayOtter's internals - the host supplies everything at runtime.",
        ],
      },
      {
        heading: "What a plugin can contribute",
        bullets: [
          "Otter tools - new AI capabilities. `read` tools answer questions inline; `action` tools are confirm-first (Otter proposes a card, the human approves before it runs).",
          "Booking lifecycle hooks - react to a meeting being created, rescheduled, or cancelled (seed a note, start a scribe, sync to an external system).",
          "Connectors - reach external services through a scoped, SSRF-guarded HTTP client and store credentials in encrypted per-plugin storage.",
        ],
      },
      {
        heading: "A minimal plugin",
        paragraphs: [
          "Every runtime function receives a context with scoped `storage` (JSON + encrypted secrets), a safe `http` client, a namespaced `logger`, and `config`. Here's a plugin that adds one confirm-first Otter tool:",
        ],
      },
      {
        bullets: [
          "id / name - a stable kebab-case id (namespaces your tools and storage) and a display name.",
          "tools[] - each has a name, JSON-schema input, a kind (read | action), and an async `run(ctx, input)`.",
          "bookingHooks[] - each declares which events it runs on and an async `handle(ctx, event, booking)`.",
        ],
      },
      {
        tip: {
          kind: "tip",
          text: "Start from the reference plugins in packages/plugins/ - `notes` (an Otter tool + a booking hook + storage) and `webhook-relay` (a connector that forwards booking events to a URL you control). Copy one and edit.",
        },
      },
      {
        heading: "Enable a plugin",
        steps: [
          "Add the plugin package to the build and import it in the host's enabled list (packages/plugin-host/src/enabled.ts).",
          "Set DAYOTTER_PLUGINS to a comma-separated list of the plugin ids you want on, e.g. DAYOTTER_PLUGINS=notes,webhook-relay.",
          "Restart. Plugins are OFF by default - the core behaves exactly as before until you opt in.",
        ],
      },
      {
        heading: "Confirm-first and safe by design",
        bullets: [
          "Action tools never run on their own - they flow through the same propose→approve card as core tools; set `danger` for a second confirmation.",
          "Storage is scoped to (your plugin, the user) - a plugin can't read another's data. Secrets are encrypted at rest.",
          "`ctx.http` refuses non-public hosts and won't follow redirects, so a plugin can't be tricked into hitting internal infrastructure.",
        ],
      },
      {
        tip: {
          kind: "warning",
          text: "Plugins run in-process with real access - only enable ones you trust. On the DayOtter cloud, plugins are a curated set; self-hosters choose exactly what to install and enable.",
        },
      },
    ],
  },
];

export function getGuide(slug: string): DocGuide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

export const DOC_CATEGORIES: DocCategory[] = [
  "Get started",
  "Scheduling",
  "Teams",
  "AI & automation",
  "Payments",
  "Build & self-host",
];
