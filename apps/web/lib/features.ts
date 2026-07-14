/**
 * Feature landing pages, rendered at /features and /features/[slug]. One page per
 * capability - the programmatic-SEO play (like Calendly's per-feature pages).
 * Each targets the search intent for that feature and links back into the product.
 */

export interface Feature {
  slug: string;
  /** Short label for nav/cards. */
  label: string;
  /** One-line descriptor for the hub grid. */
  blurb: string;
  title: string;
  subtitle: string;
  intro: string[];
  /** The key capabilities, 3–4. */
  points: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  /** Related feature slugs for internal linking. */
  related: string[];
}

export const FEATURES: Feature[] = [
  {
    slug: "ai-scheduling",
    label: "AI scheduling",
    blurb: "Talk to Otter - it books, reschedules, and protects your time, confirm-first.",
    title: "AI scheduling with Otter",
    subtitle:
      "Otter is your AI executive assistant for the calendar. Say what you want in plain words - it drafts the change and waits for your OK. Never books anything on its own.",
    intro: [
      'Most "AI scheduling" is a chatbot bolted onto a booking link. Otter is built into DayOtter from the ground up: it reads your real availability, understands "book 30 minutes with Priya Thursday" or "hold two hours for deep work," and turns it into a calendar change you confirm.',
      "It works in the app, by voice on mobile, and over WhatsApp and SMS - and it learns your patterns so its suggestions get sharper over time.",
    ],
    points: [
      {
        title: "Confirm-first, always",
        body: "Otter proposes; you approve. Nothing lands on your calendar and nothing moves without your explicit OK - no silent auto-scheduling.",
      },
      {
        title: "Grounded in your real calendar",
        body: "It reads your actual availability and bookings, so the times it suggests are ones you're truly free for - across every timezone.",
      },
      {
        title: "Everywhere you are",
        body: "Chat in the app, tap the mic on mobile, or just text Otter over WhatsApp/SMS. One assistant, every surface.",
      },
    ],
    faq: [
      {
        q: "Will the AI change my calendar without asking?",
        a: "No. Otter is confirm-first - it only ever drafts a change and waits for your confirmation.",
      },
      {
        q: "Does AI scheduling cost extra per use?",
        a: "No metered per-minute cost. It's included in Pro, and free when you self-host with your own API key.",
      },
    ],
    related: ["focus-time", "voice-receptionist", "running-late"],
  },
  {
    slug: "round-robin",
    label: "Round-robin",
    blurb: "Distribute meetings across your team, weighted and load-balanced.",
    title: "Weighted round-robin scheduling",
    subtitle:
      "Spread inbound meetings fairly across your team - weight your best closers, pause anyone who's out, and keep it load-balanced automatically.",
    intro: [
      "Round-robin routing sends each new booking to the next available team member. DayOtter's is weighted: give senior reps a higher share, set someone to zero to pause them, and it stays balanced over time - not just a naive rotation.",
      "Combine it with routing forms and collective availability to build a real team booking flow, all free to self-host.",
    ],
    points: [
      {
        title: "Weighted distribution",
        body: "Assign each member a weight to book some people more than others - by seniority, territory, or performance.",
      },
      {
        title: "Pause without breaking the rotation",
        body: "Set a weight to zero when someone's on holiday; they drop out cleanly and rejoin when you're ready.",
      },
      {
        title: "Load-balanced, not just rotated",
        body: "The engine accounts for who's already been booked, so meetings stay evenly spread instead of clustering.",
      },
    ],
    faq: [
      {
        q: "Can I weight some reps higher than others?",
        a: "Yes - every member has a weight you can tune any time; set it to zero to pause them.",
      },
      {
        q: "Is round-robin behind a paywall?",
        a: "It's included in Pro, and completely free when you self-host - unlike tools that gate team scheduling on expensive tiers.",
      },
    ],
    related: ["routing-forms", "team-scheduling", "collective"],
  },
  {
    slug: "routing-forms",
    label: "Routing forms",
    blurb: "Qualify inbound and send each visitor to the right person or event type.",
    title: "Routing forms",
    subtitle:
      "Ask a couple of questions up front, then route each visitor to the right person, team, or event type - so leads never land on the wrong desk.",
    intro: [
      "A routing form is a short set of questions on your booking page. Based on the answers, DayOtter sends the visitor to the right destination - a specific rep, a round-robin pool, or a particular event type.",
      "It's how sales teams qualify inbound instantly and route enterprise leads to closers, and how support teams get people to the right specialist - no reply-and-wait.",
    ],
    points: [
      {
        title: "Qualify before they book",
        body: "Capture the essentials (company size, topic, urgency) so the meeting starts with context.",
      },
      {
        title: "Rules, checked top to bottom",
        body: 'Write simple rules - "if Enterprise, send to sales" - with a fallback. No code, no wrong-desk bookings.',
      },
      {
        title: "Route to a person or a pool",
        body: "Send matched visitors to one host, a weighted round-robin team, or a specific event type.",
      },
    ],
    faq: [
      {
        q: "Do I need to write code for routing?",
        a: "No - routing is no-code: add questions, then rules that map answers to destinations.",
      },
    ],
    related: ["round-robin", "team-scheduling", "ai-scheduling"],
  },
  {
    slug: "focus-time",
    label: "Focus time",
    blurb: "Otter finds and protects blocks for deep work - held as real events.",
    title: "Focus-time protection",
    subtitle:
      "Ask Otter to hold time for deep work and it defends it as a real calendar event - so meetings route around your focus instead of eating into it.",
    intro: [
      'Say "hold two hours for deep work tomorrow morning" and Otter finds an open block that fits your schedule and protects it. Because it becomes a real busy block, your booking page and team availability route around it automatically.',
      "This is Reclaim/Motion territory - but confirm-first, and part of a full scheduling platform rather than a separate app.",
    ],
    points: [
      {
        title: "Held as real events",
        body: "Protected focus time shows as busy everywhere, so nobody can book over your deep work.",
      },
      {
        title: "Proactively suggested",
        body: "Otter notices open windows worth protecting and offers to hold them - you just confirm.",
      },
      {
        title: "Across every calendar",
        body: "It works whether you're on Google, Outlook, or Apple - one honest view of your real free time.",
      },
    ],
    faq: [
      {
        q: "Does it move my meetings around to make room?",
        a: "No - it protects open time, confirm-first. It never silently rearranges your calendar.",
      },
    ],
    related: ["ai-scheduling", "running-late", "analytics"],
  },
  {
    slug: "reminders",
    label: "Reminders",
    blurb: "Automatic reminders over email, SMS, WhatsApp, Slack, and push.",
    title: "Meeting reminders & notifications",
    subtitle:
      "Cut no-shows with automatic reminders on the channels people actually check - email, SMS, WhatsApp, Slack, and mobile push.",
    intro: [
      "Set your lead times once and DayOtter reminds you and your attendees before every meeting. Reminders are durable (backed by a real job queue), multi-channel, and reschedule cleanly when a meeting moves.",
      "Add before/after-event workflow messages on your own templates for confirmations, prep, and follow-ups.",
    ],
    points: [
      {
        title: "Every channel",
        body: "Email and - on Pro/self-host - SMS, WhatsApp, Slack, and push, so reminders land where people look.",
      },
      {
        title: "Reschedule-aware",
        body: "Move a meeting and the reminders re-schedule themselves; cancel it and they're cleared.",
      },
      {
        title: "Custom workflows",
        body: "Send templated before/after-event messages - prep notes, follow-ups - automatically.",
      },
    ],
    faq: [
      {
        q: "Which channels can attendees get reminders on?",
        a: "Email always; SMS, WhatsApp, Slack, and push are available on Pro and free when self-hosted.",
      },
    ],
    related: ["running-late", "ai-scheduling", "payments"],
  },
  {
    slug: "calendar-sync",
    label: "Calendar sync",
    blurb: "Google, Outlook, Apple, and ICS - one honest view of your time.",
    title: "Calendar sync",
    subtitle:
      "Connect Google, Microsoft 365, Apple iCloud, and any ICS feed. DayOtter unifies them into one source of truth for your availability - two-way, real-time.",
    intro: [
      "DayOtter reads your busy times from every calendar you connect and writes new bookings back - so you're never double-booked and everything lives in the calendar you already check.",
      "Google and Microsoft sync in real time via provider webhooks; Apple/CalDAV and ICS feeds are kept fresh by polling. Tokens are encrypted at rest.",
    ],
    points: [
      {
        title: "Every provider",
        body: "Google Calendar, Microsoft 365 / Outlook, Apple iCloud (CalDAV), and read-only ICS feeds - behind one interface.",
      },
      {
        title: "Two-way and real-time",
        body: "Busy times flow in; confirmed bookings flow out to your target calendar with the video link attached.",
      },
      {
        title: "Never double-booked",
        body: "Availability is computed against all your connected calendars at once, across timezones.",
      },
    ],
    faq: [
      {
        q: "Does it work with Apple/iCloud?",
        a: "Yes - via CalDAV with an app-specific password. Unlike some tools that dropped iCloud support, DayOtter keeps it.",
      },
    ],
    related: ["booking-pages", "ai-scheduling", "focus-time"],
  },
  {
    slug: "payments",
    label: "Payments",
    blurb: "Charge or take a deposit to book - powered by Stripe.",
    title: "Accept payments for bookings",
    subtitle:
      "Require payment or a deposit before a slot is held. Fewer no-shows, paid up front - with prepaid session packages for recurring clients.",
    intro: [
      "Connect Stripe and charge the full price or a deposit as part of booking. The slot is only confirmed once payment succeeds, so flaky free bookings stop costing you income.",
      'Sell prepaid session packages too - a bundle of sessions a client buys once, tracked as they book ("3 of 5 used").',
    ],
    points: [
      {
        title: "Full price or deposit",
        body: "Take the whole fee or just a deposit to secure the slot - your call per event type.",
      },
      {
        title: "Session packages",
        body: "Sell bundles of sessions; each booking spends a credit, tracked automatically.",
      },
      {
        title: "Stripe, secure",
        body: "Payments run on Stripe Checkout - DayOtter never stores card numbers.",
      },
    ],
    faq: [
      {
        q: "Do I need a Stripe account?",
        a: "Yes - connect Stripe and you can charge for bookings and sell packages. It's included in Pro and free to self-host.",
      },
    ],
    related: ["session-packages", "reminders", "booking-pages"],
  },
  {
    slug: "voice-receptionist",
    label: "Voice receptionist",
    blurb: "A 24/7 AI phone line that answers questions and books appointments.",
    title: "AI voice receptionist",
    subtitle:
      "Give your booking line an AI receptionist. It answers common questions, and texts callers a link to book - 24/7, grounded in your real services.",
    intro: [
      "Callers reach a warm, natural AI receptionist that answers from your knowledge base and, when they want to book, texts them a link to pick a time. It never books blind - confirm-first, over the phone.",
      "Perfect for solo service businesses, coaches, and clinics that miss calls after hours.",
    ],
    points: [
      {
        title: "Answers, grounded",
        body: "It responds only from your services and info - and defers to you rather than inventing details.",
      },
      {
        title: "Texts a booking link",
        body: "When a caller wants an appointment, it sends them a link to choose a time - no blind bookings.",
      },
      {
        title: "24/7, natural speech",
        body: "Enhanced phone-call transcription and a human-sounding voice, so callers get help any hour.",
      },
    ],
    faq: [
      {
        q: "Can it actually book on the call?",
        a: "It hands the caller a booking link to confirm a time themselves - confirm-first. Conversational booking is on the roadmap.",
      },
    ],
    related: ["ai-scheduling", "reminders", "booking-pages"],
  },
  {
    slug: "booking-pages",
    label: "Booking pages",
    blurb: "Calm, branded pages with intake, buffers, and instant video links.",
    title: "Booking pages",
    subtitle:
      "Share one link and let people book you - on a page as calm as it is capable, with intake questions, buffers, and automatic video links.",
    intro: [
      "Your booking page is a branded, fast, mobile-friendly place for anyone to grab a time that works. Add intake questions, buffers, notice periods, and multiple durations; DayOtter attaches a Google Meet, Zoom, or Teams link automatically.",
      "Unlimited event types on every plan - including free - instead of the one-event-only trap.",
    ],
    points: [
      {
        title: "Unlimited event types",
        body: "Create as many booking types as you need, free forever - intro calls, demos, office hours, whatever.",
      },
      {
        title: "Yours, branded",
        body: "Your name, accent color, welcome message, and intake questions - calm and professional, not a generic form.",
      },
      {
        title: "Video links, automatic",
        body: "Google Meet, Zoom, and Teams links are generated and attached to every booking.",
      },
    ],
    faq: [
      {
        q: "How many event types can I create?",
        a: "Unlimited, on every plan including Free - unlike Calendly's one-event free tier.",
      },
    ],
    related: ["calendar-sync", "payments", "group-polls"],
  },
  {
    slug: "group-polls",
    label: "Group polls",
    blurb: "Find a time across a group - propose slots, collect votes, lock it in.",
    title: "Group polls",
    subtitle:
      "Find one time that works across a group. Propose a few slots, let everyone vote, and finalize the winner into a real booking - no email thread.",
    intro: [
      "Group polls (Doodle-style) solve the many-people problem: propose candidate times, share the link, collect yes/no/maybe votes, and turn the most-supported slot into a booking on everyone's calendar.",
      "Great for panel interviews, team calls, and any meeting where a single link won't do.",
    ],
    points: [
      {
        title: "Propose, vote, finalize",
        body: "Offer a handful of times, let people vote, and lock in the winner - it becomes a real booking.",
      },
      {
        title: "No back-and-forth",
        body: "One link replaces the reply-all thread that usually finds a group time.",
      },
    ],
    faq: [
      {
        q: "Is this like Doodle?",
        a: "Same idea, but it finalizes straight into a booking on your calendar with reminders - not just a poll.",
      },
    ],
    related: ["booking-pages", "team-scheduling", "routing-forms"],
  },
];

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}
