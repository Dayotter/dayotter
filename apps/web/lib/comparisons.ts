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
  {
    slug: "acuity",
    name: "Acuity Scheduling",
    blurb: "Deep appointment tooling for service businesses - but Squarespace-owned, paid-only, and no AI.",
    title: "DayOtter vs Acuity Scheduling",
    subtitle:
      "Acuity is built for salons, clinics and studios that live on appointments. DayOtter covers the same booking-and-pay basics, adds team scheduling and an AI assistant, and starts free - not at $16 a month.",
    intro: [
      "Acuity Scheduling (owned by Squarespace) is a mature appointment tool aimed at service businesses - classes, intake forms, packages, calendar sync. If your whole business is back-to-back appointments, it's deep and well-worn.",
      "DayOtter handles the same essentials - paid bookings, intake questions, packages, reminders - then adds team round-robin, routing, and Otter, a confirm-first assistant you can just talk to. There's a genuinely free plan, and you can self-host the whole thing.",
    ],
    theirStrength:
      "Acuity's appointment features run deep - class scheduling, intake forms, gift certificates, subscriptions and point-of-sale style add-ons - and it's tightly integrated with Squarespace sites. For an established salon or clinic already on Squarespace, it's a proven fit.",
    rows: [
      { label: "Free plan", dayotter: "Yes - unlimited event types", them: "No - paid from ~$16/mo", edge: "us" },
      { label: "Price entry point", dayotter: "Free / $9 seat", them: "~$16–49 / month", edge: "us" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat to book, protect focus",
        them: "None",
        edge: "us",
      },
      { label: "Paid bookings & packages", dayotter: "Yes (Stripe)", them: "Yes (mature)", edge: "tie" },
      { label: "Intake forms", dayotter: "Yes", them: "Yes (deep)", edge: "tie" },
      { label: "Team round-robin & routing", dayotter: "Weighted, built in", them: "Limited", edge: "us" },
      { label: "Class / group scheduling", dayotter: "Group polls + limits", them: "Native classes", edge: "them" },
      { label: "Focus / time protection", dayotter: "Yes", them: "None", edge: "us" },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "Free where Acuity is paid-only",
        body: "Acuity has no free tier - you pay from day one. DayOtter is free for individuals with unlimited event types, paid bookings included, and $9/seat when you add a team.",
      },
      {
        title: "An assistant, not just forms",
        body: 'Tell Otter "add a 60-minute massage type at $90, Tuesdays and Thursdays" - it drafts it and waits for your OK. Acuity is powerful, but you configure everything by hand.',
      },
      {
        title: "Team scheduling built in",
        body: "Weighted round-robin and routing come standard, so a multi-practitioner studio can send each client to the right person - without Acuity's higher tiers.",
      },
    ],
    chooseThem:
      "You run a class-heavy or retail service business, you're already on Squarespace, and you need Acuity's mature class booking, gift certificates and POS-style add-ons today.",
    chooseUs:
      "You want appointment booking and payments that start free, an AI assistant that sets things up for you, and team routing built in - with the option to self-host.",
    faq: [
      {
        q: "Is DayOtter a good Acuity alternative for a clinic or studio?",
        a: "Yes - it does paid bookings, intake questions, packages, reminders and calendar sync, plus team round-robin. The main gap is Acuity's native class scheduling and POS-style extras.",
      },
      {
        q: "Does DayOtter have a free plan? Acuity doesn't.",
        a: "Yes - individuals are free with unlimited event types and paid bookings via Stripe. Acuity is paid-only from around $16/month.",
      },
    ],
  },
  {
    slug: "savvycal",
    name: "SavvyCal",
    blurb: "A lovely booking experience - but solo-focused, paid-only, closed, and no AI.",
    title: "DayOtter vs SavvyCal",
    subtitle:
      "SavvyCal is loved for a polished, invitee-friendly booking flow. DayOtter matches the scheduling, adds an AI assistant and time protection, starts free, and can be self-hosted.",
    intro: [
      "SavvyCal earned its fans with a genuinely nice booking experience - overlay-your-calendar scheduling, personalized links, tasteful design. For an individual who cares about how booking feels, it's a favourite.",
      "DayOtter shares that care for the invitee, then goes further: Otter can do the scheduling for you, defend your focus time, and handle team round-robin and routing - free for individuals, and self-hostable under AGPLv3.",
    ],
    theirStrength:
      "SavvyCal's invitee experience is a highlight - letting people overlay their own calendar on yours to find a mutual time is genuinely elegant, and its personalization and polish are well ahead of the basics.",
    rows: [
      { label: "Free plan", dayotter: "Yes - unlimited event types", them: "No - paid from ~$12/mo", edge: "us" },
      { label: "Price", dayotter: "Free / $9 seat", them: "~$12–20 / seat", edge: "us" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "None",
        edge: "us",
      },
      { label: "Overlay-calendar booking", dayotter: "Availability preview", them: "Yes (signature)", edge: "them" },
      { label: "Personalized links", dayotter: "Yes", them: "Yes (polished)", edge: "tie" },
      { label: "Team round-robin & routing", dayotter: "Weighted, built in", them: "Basic teams", edge: "us" },
      { label: "Focus / time protection", dayotter: "Yes", them: "None", edge: "us" },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "Free, where SavvyCal is paid-only",
        body: "SavvyCal has no free tier. DayOtter gives individuals unlimited event types, calendar sync and reminders free, forever - pay only when a team joins.",
      },
      {
        title: "An assistant does the work",
        body: 'SavvyCal makes booking pleasant; Otter takes it off your plate entirely - "find 30 minutes with Sam next week" and it drafts the booking for your OK.',
      },
      {
        title: "Time protection and self-hosting",
        body: "DayOtter defends focus time and warns your next meeting when you're running late, and its core is open-source and self-hostable. SavvyCal is closed and cloud-only.",
      },
    ],
    chooseThem:
      "You're an individual who wants the most polished, invitee-delighting booking flow - especially the overlay-your-calendar experience - and you don't need teams or AI.",
    chooseUs:
      "You want that same care for the invitee plus an AI assistant, time protection and team routing - starting free, with the option to self-host.",
    faq: [
      {
        q: "Does DayOtter have SavvyCal's overlay-calendar booking?",
        a: "DayOtter shows a clear availability preview and timezone-aware slots; SavvyCal's signature overlay-your-own-calendar view is uniquely theirs. For most bookers the experience is comparably smooth.",
      },
      {
        q: "Is DayOtter cheaper than SavvyCal?",
        a: "Yes - individuals are free (SavvyCal is paid-only from ~$12/month), and teams are $9/seat with self-hosting free.",
      },
    ],
  },
  {
    slug: "doodle",
    name: "Doodle",
    blurb: "The classic group poll - but ad-supported free, dated, and thin on real scheduling.",
    title: "DayOtter vs Doodle",
    subtitle:
      "Doodle is the group-poll everyone remembers. DayOtter does group polls too - then adds real booking pages, team routing, reminders and an AI assistant, without the ads.",
    intro: [
      "Doodle made finding a group time popular: propose a few slots, everyone ticks what works, pick the winner. For a one-off group meeting, it still does the job.",
      "But Doodle is thin beyond the poll - its free tier shows ads, its booking pages are basic, and there's no team routing or assistant. DayOtter includes group polls and wraps them in a full, calm scheduling platform.",
    ],
    theirStrength:
      "Doodle's group poll is simple, universally understood, and quick to fire off - if all you need is a one-time vote on a meeting time among a handful of people, it's familiar and low-friction.",
    rows: [
      { label: "Group polls / meeting votes", dayotter: "Yes", them: "Yes (core)", edge: "tie" },
      { label: "Ad-free", dayotter: "Yes, always", them: "Ads on free tier", edge: "us" },
      { label: "Real booking pages", dayotter: "Unlimited, branded", them: "Basic", edge: "us" },
      { label: "Team round-robin & routing", dayotter: "Weighted, built in", them: "None", edge: "us" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "None",
        edge: "us",
      },
      { label: "Reminders (SMS/Slack/WhatsApp)", dayotter: "Yes", them: "Email only", edge: "us" },
      { label: "Payments to book", dayotter: "Yes (Stripe)", them: "No", edge: "us" },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "The poll, plus everything after it",
        body: "Group polls are one feature in DayOtter, not the whole product. You also get branded booking pages, team round-robin, routing, cross-channel reminders and payments.",
      },
      {
        title: "No ads, ever",
        body: "Doodle's free tier serves ads to your invitees. DayOtter's free plan is clean and calm - your booking page represents you, not an ad network.",
      },
      {
        title: "An assistant and real teams",
        body: "Ask Otter to set up a poll or a booking type, and run weighted round-robin across a team - things Doodle simply doesn't do.",
      },
    ],
    chooseThem:
      "You only ever need a quick, familiar one-off group vote on a meeting time and don't want any of the surrounding tooling.",
    chooseUs:
      "You want group polls as part of a real scheduling platform - booking pages, team routing, reminders, payments and an assistant - with no ads and the option to self-host.",
    faq: [
      {
        q: "Does DayOtter do group polls like Doodle?",
        a: "Yes - propose several times, let everyone vote, and lock in the most-supported slot as a real booking with invites and reminders. No ads on any tier.",
      },
      {
        q: "What does DayOtter add over Doodle?",
        a: "Branded booking pages, weighted team round-robin, routing forms, cross-channel reminders, payments, and Otter - the confirm-first AI assistant.",
      },
    ],
  },
  {
    slug: "youcanbookme",
    name: "YouCanBook.me",
    blurb: "Flexible booking customization - but fiddly, dated, and no team AI.",
    title: "DayOtter vs YouCanBook.me",
    subtitle:
      "YouCanBook.me is a customizable booking page with lots of knobs. DayOtter gives you the same control with a calmer setup, adds an AI assistant and time protection, and starts free.",
    intro: [
      "YouCanBook.me has been around a long time and leans into customization - branding, notifications, tweak-everything booking pages. If you love configuring, it's flexible.",
      "DayOtter offers the same essentials with far less fiddling: sensible defaults, a clean page out of the box, and Otter to set things up by chat. Plus team round-robin, routing and focus protection - free for individuals.",
    ],
    theirStrength:
      "YouCanBook.me's depth of customization on the booking page and notifications is real - if you want to control every string, colour and email, it gives you a lot of levers to pull.",
    rows: [
      { label: "Free plan", dayotter: "Yes - unlimited event types", them: "Limited free / paid tiers", edge: "us" },
      { label: "Price (paid)", dayotter: "$9 / seat", them: "~$10.8 / seat", edge: "tie" },
      {
        label: "AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "None",
        edge: "us",
      },
      { label: "Booking-page customization", dayotter: "Clean, sensible defaults", them: "Deep, fiddly", edge: "tie" },
      { label: "Ease of setup", dayotter: "Minutes", them: "More configuration", edge: "us" },
      { label: "Team round-robin & routing", dayotter: "Weighted, built in", them: "Team booking", edge: "us" },
      { label: "Focus / time protection", dayotter: "Yes", them: "None", edge: "us" },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "Calm by default, not a config maze",
        body: "DayOtter looks right out of the box and lets Otter handle setup by chat. YouCanBook.me gives you endless knobs - powerful, but a lot to tune.",
      },
      {
        title: "An assistant and time protection",
        body: "Otter books, reschedules and protects focus time, and warns your next meeting when you're running late - things YouCanBook.me doesn't touch.",
      },
      {
        title: "Open and self-hostable",
        body: "Run DayOtter on your own servers under AGPLv3 with every feature unlocked. YouCanBook.me is closed and cloud-only.",
      },
    ],
    chooseThem:
      "You want to hand-tune every detail of the booking page and notifications and you enjoy the configuration.",
    chooseUs:
      "You want a clean booking experience that just works, an AI assistant to set it up, team routing and focus protection - free to start and self-hostable.",
    faq: [
      {
        q: "Is DayOtter easier to set up than YouCanBook.me?",
        a: "Generally yes - it ships with sensible defaults and a clean page, and Otter can create booking types by chat, so there's far less to configure.",
      },
      {
        q: "Can DayOtter customize the booking page too?",
        a: "Yes - brand colour, welcome message, intake questions, buffers, notice and per-type rules. It aims for calm defaults rather than infinite knobs.",
      },
    ],
  },
  {
    slug: "clockwise",
    name: "Clockwise",
    blurb: "Smart focus-time defense for teams - but Google/Slack-bound, and it doesn't take bookings.",
    title: "DayOtter vs Clockwise",
    subtitle:
      "Clockwise optimizes a team's calendar for focus time. DayOtter protects focus too - but asks before it acts, works across every calendar, and also does booking links and team scheduling.",
    intro: [
      "Clockwise is a calendar optimizer for teams: it shuffles flexible meetings to create shared focus time and syncs status to Slack. For a Google-and-Slack company chasing more deep-work hours, it's clever.",
      "DayOtter shares the focus-protection instinct but takes a confirm-first approach - Otter proposes, you approve - and it isn't Google-only. It's also a full scheduling tool: booking pages, team round-robin, routing and polls, which Clockwise doesn't do.",
    ],
    theirStrength:
      "Clockwise's automatic focus-time optimization across a whole team's calendars, plus its smart meeting-moving and Slack status sync, is genuinely useful for large Google Workspace orgs trying to claw back concentration time.",
    rows: [
      { label: "Focus / deep-work protection", dayotter: "Yes", them: "Yes (core)", edge: "tie" },
      {
        label: "Approach",
        dayotter: "Confirm-first - you approve moves",
        them: "Auto-moves flexible meetings",
        edge: "us",
      },
      {
        label: "Calendars supported",
        dayotter: "Google, Outlook, Apple, ICS",
        them: "Google (Outlook limited)",
        edge: "us",
      },
      { label: "Booking links (let others book you)", dayotter: "Yes", them: "No", edge: "us" },
      { label: "Team round-robin & routing", dayotter: "Weighted, built in", them: "No", edge: "us" },
      { label: "Running-late overflow alerts", dayotter: "Yes", them: "No", edge: "us" },
      {
        label: "Conversational AI assistant",
        dayotter: "Otter - chat, confirm-first",
        them: "Rules-based automation",
        edge: "us",
      },
      { label: "Open source / self-host", dayotter: "Yes", them: "No", edge: "us" },
    ],
    whyUs: [
      {
        title: "It asks before it moves things",
        body: "Clockwise auto-shuffles flexible meetings to make focus time. Otter proposes focus blocks and reschedules and waits for your OK - no surprise calendar changes.",
      },
      {
        title: "Scheduling, not just optimization",
        body: "DayOtter also lets people book you and runs team round-robin, routing forms and polls. Clockwise optimizes your existing calendar; it doesn't take bookings.",
      },
      {
        title: "Every calendar, and open",
        body: "Focus protection works across Google, Outlook and Apple, and the core is self-hostable under AGPLv3. Clockwise is Google-centric and closed.",
      },
    ],
    chooseThem:
      "You're a large Google Workspace org that wants automatic, team-wide focus-time optimization and Slack status sync, and you don't need booking links.",
    chooseUs:
      "You want focus protection that asks first, across every calendar, plus booking pages and team scheduling in one open, self-hostable platform.",
    faq: [
      {
        q: "Does DayOtter protect focus time like Clockwise?",
        a: "Yes - Otter finds and holds deep-work time and adds running-late alerts. The difference is it proposes and you confirm, rather than automatically moving your meetings.",
      },
      {
        q: "Can DayOtter take bookings? Clockwise can't.",
        a: "Yes - booking pages, team round-robin, routing and group polls are all built in, alongside focus protection.",
      },
    ],
  },
];

export function getComparison(slug: string): Comparison | undefined {
  return COMPARISONS.find((c) => c.slug === slug);
}
