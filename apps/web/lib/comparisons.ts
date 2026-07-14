/**
 * Head-to-head comparison content, rendered at /vs and /vs/[slug]. Candid by
 * design - concede what the competitor does well, then make the honest case for
 * DayOtter. Grounded in the competitive analysis; update as the market moves.
 */

export interface CompareRow {
  label: string;
  dayotter: string;
  them: string;
  /** Who wins this row - tints the cell. */
  edge?: "us" | "them" | "tie";
}

export interface Comparison {
  slug: string;
  /** Competitor display name, e.g. "Calendly". */
  name: string;
  /** One-line descriptor for the /vs hub card. */
  blurb: string;
  title: string;
  subtitle: string;
  /** 1–2 intro paragraphs. */
  intro: string[];
  /** What they genuinely do well - stated plainly. */
  theirStrength: string;
  rows: CompareRow[];
  whyUs: { title: string; body: string }[];
  /** Honest "pick them if / pick us if". */
  chooseThem: string;
  chooseUs: string;
  faq: { q: string; a: string }[];
}

export const COMPARISONS: Comparison[] = [
  {
    slug: "calendly",
    name: "Calendly",
    blurb: "The category default - polished, but a crippled free tier and no self-host.",
    title: "DayOtter vs Calendly",
    subtitle:
      "Calendly set the standard for booking links. DayOtter matches the scheduling and adds an AI assistant that actually does the work - at a third of the price, with a free plan you can live on.",
    intro: [
      "Calendly is the tool most people picture when they hear \"scheduling link.\" It's polished and dependable, and for years it was the safe default. The catch: its free plan gives you exactly one event type, the team features get expensive fast, and there's no way to run it yourself.",
      "DayOtter covers the same core - booking pages, team round-robin, reminders, payments, calendar sync - then adds Otter, a proactive assistant you can just talk to. And the free plan is genuinely usable, not a demo.",
    ],
    theirStrength:
      "Calendly's invitee experience is famously smooth, its CRM integrations (Salesforce, HubSpot) are mature, and its enterprise admin controls are battle-tested. If you're a large revenue org already standardized on Salesforce, it's a proven choice.",
    rows: [
      {
        label: "Free plan",
        dayotter: "Unlimited event types",
        them: "One event type only",
        edge: "us",
      },
      { label: "Price (teams)", dayotter: "$9 / seat", them: "$16–20 / seat", edge: "us" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat to book, protect focus, confirm-first",
        them: "Routing only",
        edge: "us",
      },
      {
        label: "Time protection",
        dayotter: "Focus auto-scheduling + running-late alerts",
        them: "None",
        edge: "us",
      },
      {
        label: "Team scheduling",
        dayotter: "Weighted round-robin & collective",
        them: "Round-robin & collective",
        edge: "tie",
      },
      { label: "Routing forms", dayotter: "Yes", them: "Yes", edge: "tie" },
      {
        label: "CRM (Salesforce/HubSpot)",
        dayotter: "On the roadmap",
        them: "Native, mature",
        edge: "them",
      },
      { label: "Apple iCloud sync", dayotter: "Yes", them: "Dropped in 2024", edge: "us" },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "A free plan you can actually use",
        body: "Calendly's free tier stops at one event type. DayOtter gives you unlimited event types, calendar sync, group polls and reminders free, forever - solo users rarely need to pay at all.",
      },
      {
        title: "An assistant, not just a link",
        body: 'Tell Otter "block two hours for deep work" or "find 30 minutes with Priya" - it drafts it and waits for your OK. Calendly can share your availability; it can\'t take the work off your plate.',
      },
      {
        title: "Your data, your call",
        body: "DayOtter's core is open-source and self-hostable. Run it on your own servers with every feature unlocked, or use our cloud. Calendly is closed and cloud-only.",
      },
    ],
    chooseThem:
      "You're a large sales org deeply invested in Salesforce and need its most mature CRM routing and enterprise admin today.",
    chooseUs:
      "You want the same scheduling for a fraction of the price, a free plan that isn't a trap, an AI assistant that does the scheduling, and the option to self-host.",
    faq: [
      {
        q: "Is DayOtter a drop-in Calendly replacement?",
        a: "For the everyday flow - booking pages, team round-robin, reminders, payments, calendar sync - yes. The main gap today is native Salesforce/HubSpot CRM, which is on our roadmap.",
      },
      {
        q: "How much cheaper is DayOtter?",
        a: "Teams are $9/seat vs Calendly's $16–20/seat, and individuals are free with unlimited event types. Self-hosting is free with every feature.",
      },
      {
        q: "Can I import my Calendly setup?",
        a: "You recreate your event types in DayOtter (it takes a few minutes) and point your calendar connections over. There's no lock-in either way.",
      },
    ],
  },
  {
    slug: "cal-com",
    name: "Cal.com",
    blurb:
      "Went closed-source in 2026, leaving a stripped MIT fork. DayOtter is the open alternative.",
    title: "DayOtter vs Cal.com",
    subtitle:
      "Cal.com was the open-source scheduler for years - then moved its core to a closed repo in 2026, keeping only a stripped-down fork with the commercial features removed. DayOtter is the genuinely open alternative: AGPLv3, the whole product, AI included.",
    intro: [
      'For years Cal.com was the open-source scheduler developers loved - API-first, self-hostable, strong routing. In April 2026 it moved its production codebase to a closed repository (citing AI), keeping a separate MIT fork, "Cal.diy", with the commercial features - Organizations, Teams, Routing, Workflows, Instant Booking - removed. So the open version is now a demo, and the real product is closed.',
      "DayOtter took the opposite path. The whole product - teams, routing, workflows, and all of Otter's AI - is AGPLv3 and self-hostable, free forever. And it's built around Otter, a confirm-first assistant that books, protects focus, and handles overflow at no per-minute cost (Cal.com's AI was a usage-priced voice add-on).",
    ],
    theirStrength:
      "Cal.com's API and app ecosystem are mature, and their hosted product is polished. If you want a managed scheduling API and don't mind that the core is now closed, it's an established choice.",
    rows: [
      {
        label: "License",
        dayotter: "AGPLv3 - genuinely open",
        them: "Core closed (2026); stripped MIT fork",
        edge: "us",
      },
      {
        label: "Self-host the whole product",
        dayotter: "Yes - teams, routing, AI, all of it",
        them: "Fork has commercial features removed",
        edge: "us",
      },
      { label: "Generous free plan", dayotter: "Yes", them: "Yes", edge: "tie" },
      {
        label: "AI assistant",
        dayotter: "Otter, included - chat + confirm-first",
        them: "Cal.ai was usage-priced voice (~$0.29/min)",
        edge: "us",
      },
      {
        label: "Time protection",
        dayotter: "Focus auto-scheduling + running-late alerts",
        them: "None",
        edge: "us",
      },
      { label: "Routing forms", dayotter: "Yes", them: "Yes (flagship)", edge: "tie" },
      { label: "Team round-robin", dayotter: "Weighted", them: "Weighted", edge: "tie" },
      {
        label: "Developer platform / API",
        dayotter: "Keys & webhooks",
        them: "Deeper, platform API",
        edge: "them",
      },
      {
        label: "Enterprise (SSO/SCIM)",
        dayotter: "On the roadmap",
        them: "On Orgs tier",
        edge: "them",
      },
      {
        label: "Ease of setup",
        dayotter: "Calm, opinionated",
        them: "Powerful, more to configure",
        edge: "us",
      },
    ],
    whyUs: [
      {
        title: "Still genuinely open source",
        body: "Cal.com moved its core to a closed repo and stripped the commercial features out of its open fork. DayOtter is AGPLv3 - teams, routing, workflows, and all of Otter's AI are in the open core, self-hostable and free forever. Not a demo.",
      },
      {
        title: "The assistant is the product, not an add-on",
        body: "Talking to Otter is the main way to get things done - book, reschedule, protect focus, confirm-first, at no metered cost. Cal.com's AI was a separate voice product billed by the minute.",
      },
      {
        title: "Time protection built in",
        body: "Otter finds open time and holds it for deep work, and warns your next meeting when you're running behind - Reclaim/Motion territory Cal.com never touched.",
      },
    ],
    chooseThem:
      "You want a mature, managed scheduling API and app ecosystem, and you're comfortable that the core is now closed.",
    chooseUs:
      "You want a genuinely open, self-hostable platform - the whole product, AI included - with a proactive assistant and time protection built in.",
    faq: [
      {
        q: "Didn't Cal.com go closed source?",
        a: "Yes - in April 2026 Cal.com moved its production code to a closed repository and kept only a stripped MIT fork with the commercial features (Orgs, Teams, Routing, Workflows) removed. DayOtter stayed open: AGPLv3, the whole product self-hostable.",
      },
      {
        q: "Is DayOtter really fully open source?",
        a: "The core - everything except a small cloud-only infrastructure layer (managed keys, SSO, white-label) - is AGPLv3 and self-hostable for free, including every AI feature. See our docs on editions and the enterprise boundary.",
      },
      {
        q: "Can I self-host DayOtter?",
        a: "Yes - it ships with Docker/compose and unlocks every Pro feature for free when self-hosted. No license key, no billing.",
      },
    ],
  },
  {
    slug: "motion",
    name: "Motion",
    blurb: "Powerful auto-scheduling - but pricey, desktop-first, and it reschedules you silently.",
    title: "DayOtter vs Motion",
    subtitle:
      "Motion auto-plans your day with a powerful engine. DayOtter protects your time too - but asks before it acts, costs less, and also handles booking links and team scheduling.",
    intro: [
      "Motion is the heavyweight of AI auto-scheduling: it rearranges your tasks and meetings to fit. It's genuinely capable - and it's built for desktop power users who'll invest in learning it.",
      "DayOtter shares the time-protection instinct but takes a calmer approach: Otter proposes, you confirm - it never silently moves your calendar. And it's also a full booking-link and team-scheduling tool, at roughly a third of the price.",
    ],
    theirStrength:
      "Motion's auto-scheduling engine is powerful, and for a solo power user drowning in tasks who wants the software to just decide, it can be a real force multiplier on desktop.",
    rows: [
      {
        label: "Approach",
        dayotter: "Confirm-first - you approve every change",
        them: "Can silently reschedule",
        edge: "us",
      },
      { label: "Price", dayotter: "Free / $9 seat", them: "~$19–29 / month", edge: "us" },
      { label: "Learning curve", dayotter: "Minutes", them: "Weeks", edge: "us" },
      {
        label: "Booking links (let others book you)",
        dayotter: "Yes",
        them: "Limited",
        edge: "us",
      },
      { label: "Team round-robin & routing", dayotter: "Yes", them: "Limited", edge: "us" },
      { label: "Focus auto-scheduling", dayotter: "Yes", them: "Yes (core)", edge: "tie" },
      {
        label: "Mobile experience",
        dayotter: "Web today, apps coming",
        them: "Poorly rated",
        edge: "tie",
      },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "It asks first",
        body: "The scariest thing about auto-schedulers is waking up to a rearranged calendar. Otter proposes changes and waits for your OK - you're always in control.",
      },
      {
        title: "Scheduling and booking in one",
        body: "Motion is a personal planner. DayOtter also lets people book you, runs team round-robin, routing forms and group polls - one tool instead of two.",
      },
      {
        title: "A fraction of the cost",
        body: "Motion is ~$19–29/month. DayOtter is free for individuals and $9/seat for teams, with self-hosting free.",
      },
    ],
    chooseThem:
      "You're a solo desktop power user who wants software to aggressively auto-plan a heavy task load and you'll invest weeks to master it.",
    chooseUs:
      "You want focus protection that asks before it acts, plus booking links and team scheduling, without the price tag or the learning curve.",
    faq: [
      {
        q: "Does DayOtter auto-schedule my tasks like Motion?",
        a: "Otter finds and protects focus/task time for you - but it proposes and you confirm, rather than silently rearranging your day.",
      },
      {
        q: "Is DayOtter cheaper than Motion?",
        a: "Considerably. Free for individuals, $9/seat for teams, vs Motion's ~$19–29/month - and DayOtter also does booking links and team scheduling.",
      },
    ],
  },
  {
    slug: "reclaim",
    name: "Reclaim",
    blurb: "Great focus defense - but Google-only, and it doesn't do booking links or teams.",
    title: "DayOtter vs Reclaim",
    subtitle:
      "Reclaim pioneered defending focus time on Google Calendar. DayOtter does focus protection too - plus booking links, team scheduling, and an assistant you can just talk to, across every calendar.",
    intro: [
      "Reclaim is beloved for guarding deep work and habits on Google Calendar. If your whole life is in Google and you want smart focus blocks, it's a great fit.",
      "DayOtter brings the same focus-defense instinct but isn't Google-only, and it's a full scheduling platform: booking pages, team round-robin, routing, polls - with Otter, a conversational assistant, tying it together.",
    ],
    theirStrength:
      "Reclaim's habit and focus-time automation on Google Calendar is mature and thoughtful, with smart defense of recurring routines. For a Google-native solo user focused purely on protecting time, it's excellent.",
    rows: [
      { label: "Focus / deep-work protection", dayotter: "Yes", them: "Yes (core)", edge: "tie" },
      { label: "Running-late overflow alerts", dayotter: "Yes", them: "No", edge: "us" },
      {
        label: "Calendars supported",
        dayotter: "Google, Outlook, Apple, ICS",
        them: "Google-first",
        edge: "us",
      },
      { label: "Booking links (let others book you)", dayotter: "Yes", them: "Yes", edge: "tie" },
      { label: "Team round-robin & routing", dayotter: "Yes", them: "Limited", edge: "us" },
      {
        label: "Conversational AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "No",
        edge: "us",
      },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "Not just Google",
        body: "Reclaim is happiest on Google Calendar. DayOtter unifies Google, Outlook, Apple and ICS into one honest view of your time.",
      },
      {
        title: "A whole scheduling platform",
        body: "Beyond focus blocks, DayOtter does booking pages, team round-robin, routing forms and group polls - Reclaim is focused on defending your own time.",
      },
      {
        title: "Just talk to it",
        body: "Ask Otter to protect time, book a meeting or move your 3pm. Reclaim automates rules; DayOtter adds a conversational, confirm-first assistant on top.",
      },
    ],
    chooseThem:
      "You live entirely in Google Calendar and want a mature, focused tool purely for defending deep-work and habits.",
    chooseUs:
      "You want focus protection across every calendar, plus booking links and team scheduling, with an assistant you can talk to.",
    faq: [
      {
        q: "Does DayOtter protect focus time like Reclaim?",
        a: "Yes - Otter finds open time and holds it for deep work, and adds running-late alerts when meetings run over. It works across Google, Outlook and Apple, not just Google.",
      },
    ],
  },
  {
    slug: "google-calendar",
    name: "Google Calendar",
    blurb: "Where your events live - but its booking is bare-bones, with no team routing or AI.",
    title: "DayOtter vs Google Calendar",
    subtitle:
      "Google Calendar is the calendar. DayOtter is the scheduling layer on top - booking pages, team routing, focus protection and an assistant - working with your Google Calendar, not replacing it.",
    intro: [
      'Google Calendar is where most of us actually keep our time, and its built-in "appointment schedules" let people grab a slot. For one person with simple needs, that can be enough.',
      "But the moment you need team round-robin, routing, reminders across channels, payments, or an assistant that protects your focus, you've outgrown it. DayOtter adds all of that - and syncs straight into the Google Calendar you already live in.",
    ],
    theirStrength:
      "Google Calendar is free, everyone already has it, and it's rock-solid at the basics - events, invites, and simple one-person appointment booking inside the Google ecosystem.",
    rows: [
      {
        label: "Where your events live",
        dayotter: "Syncs with Google (+ Outlook, Apple)",
        them: "Native",
        edge: "tie",
      },
      {
        label: "Booking pages",
        dayotter: "Unlimited, branded, with intake",
        them: "Basic appointment schedules",
        edge: "us",
      },
      { label: "Team round-robin & routing", dayotter: "Yes, weighted", them: "None", edge: "us" },
      {
        label: "Reminders (SMS / Slack / WhatsApp)",
        dayotter: "Yes",
        them: "Email only",
        edge: "us",
      },
      { label: "Payments to book", dayotter: "Yes (Stripe)", them: "No", edge: "us" },
      { label: "Focus auto-scheduling", dayotter: "Yes", them: "None", edge: "us" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "None",
        edge: "us",
      },
      {
        label: "Calendars supported",
        dayotter: "Google, Outlook, Apple, ICS",
        them: "Google only",
        edge: "us",
      },
      { label: "Price", dayotter: "Free / $9 seat", them: "Free", edge: "tie" },
    ],
    whyUs: [
      {
        title: "It builds on Google, not against it",
        body: "DayOtter reads and writes your Google Calendar, so everything stays in the calendar you already check. You gain booking pages, routing and an assistant without leaving it behind.",
      },
      {
        title: "Real booking, not a bare slot picker",
        body: "Branded pages, intake questions, buffers, multiple event types, cross-channel reminders and payments - the things Google's appointment schedules simply don't do.",
      },
      {
        title: "A team tool, and an assistant",
        body: "Weighted round-robin, routing forms and group polls for teams, plus Otter to book meetings and defend your focus time by chat, confirm-first.",
      },
    ],
    chooseThem:
      "You're one person, you only use Google, and simple appointment slots inside Google Calendar are all you'll ever need.",
    chooseUs:
      "You want proper booking pages, team routing, cross-channel reminders, payments and an AI assistant - layered on top of the Google Calendar you already use.",
    faq: [
      {
        q: "Does DayOtter replace Google Calendar?",
        a: "No - it works with it. Connect your Google account and DayOtter syncs both ways, so your bookings show up in the calendar you already use.",
      },
      {
        q: "Isn't Google's appointment scheduling free?",
        a: "It is, and it's fine for simple one-person booking. DayOtter adds team round-robin, routing, cross-channel reminders, payments and an AI assistant - and is still free for individuals.",
      },
      {
        q: "Will my DayOtter bookings show in Google Calendar?",
        a: "Yes. Every booking writes straight to your connected Google Calendar (or Outlook or Apple), with the video link attached.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
