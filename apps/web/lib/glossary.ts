/**
 * Scheduling glossary, rendered at /glossary and /glossary/[slug]. Long-tail SEO:
 * one indexable page per term people actually search ("what is round-robin
 * scheduling", "collective availability", etc.). Each entry defines the term
 * plainly, then ties it back to how DayOtter does it - honest, not stuffed.
 */

export type GlossaryCategory = "Scheduling" | "Teams" | "Availability" | "AI" | "Payments";

export interface GlossaryTerm {
  slug: string;
  term: string;
  category: GlossaryCategory;
  /** One-sentence definition - used on the hub, in metadata, and as the lede. */
  short: string;
  /** 1–3 explanatory paragraphs. */
  body: string[];
  /** How DayOtter implements or relates to the concept. */
  inDayOtter: string;
  /** Slugs of closely related terms, for cross-linking. */
  related: string[];
  /** Optional internal links to a relevant product/marketing page. */
  seeAlso?: { label: string; href: string }[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "round-robin-scheduling",
    term: "Round-robin scheduling",
    category: "Teams",
    short:
      "A way to distribute incoming bookings across a team so each member gets a fair, rotating share instead of one person taking them all.",
    body: [
      "Round-robin scheduling shares a single booking link across several people and hands each new booking to the next available team member in rotation. It's how sales teams spread demo requests, support teams share callbacks, and recruiters distribute first-round screens - one link, many hosts, balanced load.",
      "Basic round-robin treats everyone equally. Weighted round-robin lets you tilt the rotation - book your strongest closers more often, or pause someone who's on holiday - while still keeping the overall distribution fair and load-balanced.",
    ],
    inDayOtter:
      "DayOtter's round-robin is weighted: give each member a weight to book them more or less often, set a weight to zero to pause anyone who's away, and it stays load-balanced automatically. It only ever offers times when the chosen host is genuinely free.",
    related: ["collective-availability", "routing-form", "meeting-distribution"],
    seeAlso: [
      { label: "DayOtter for teams", href: "/for/teams" },
      { label: "DayOtter for sales", href: "/for/sales" },
    ],
  },
  {
    slug: "collective-availability",
    term: "Collective availability",
    category: "Teams",
    short:
      "A booking mode that finds a time when several required people are all free at once - for panels, group calls and reviews.",
    body: [
      "Where round-robin sends a booking to one of many hosts, collective availability requires several people to attend together. The booking page only offers slots where everyone required is simultaneously free, so a panel interview or a client review lands in one go instead of a dozen-message thread.",
      "It works by intersecting every required attendee's real free/busy across all their connected calendars, then showing only the times that survive.",
    ],
    inDayOtter:
      "Create a collective booking type, add the required people, and DayOtter shows only the slots where all of them are free - across Google, Outlook and Apple calendars, in every attendee's timezone.",
    related: ["round-robin-scheduling", "group-poll", "free-busy"],
    seeAlso: [{ label: "DayOtter for recruiters", href: "/for/recruiters" }],
  },
  {
    slug: "routing-form",
    term: "Routing form",
    category: "Teams",
    short:
      "A short set of questions on a booking page that sends each visitor to the right person or meeting type based on their answers.",
    body: [
      "A routing form (or qualification form) asks a couple of questions up front - company size, product interest, issue type - then applies simple rules to decide where the booking goes. Enterprise leads reach a senior rep; support questions reach the right queue; the wrong person never fields the wrong meeting.",
      "For sales teams it doubles as lead qualification, dropping a scored lead straight onto the right rep's live availability with no reply-and-wait gap.",
    ],
    inDayOtter:
      "Build a no-code routing form with rules checked top to bottom and a fallback. Each visitor is sent to the right event type, person or team - and can combine with weighted round-robin behind the rule.",
    related: ["round-robin-scheduling", "meeting-distribution", "lead-routing"],
    seeAlso: [{ label: "DayOtter for sales", href: "/for/sales" }],
  },
  {
    slug: "lead-routing",
    term: "Lead routing",
    category: "Teams",
    short:
      "Automatically directing inbound leads to the right sales rep the moment they book, based on qualifying answers.",
    body: [
      "Lead routing is the sales-specific case of a routing form: an inbound prospect answers a question or two, gets qualified, and books directly onto the right rep's calendar - by territory, segment or product. The goal is speed-to-lead: cut the delay between a form fill and a booked meeting to zero.",
      "Slow routing (form submitted, then a rep emails back to schedule) is where inbound interest cools. Instant routing keeps the lead in the flow.",
    ],
    inDayOtter:
      "A DayOtter routing form scores and routes a lead onto the right rep's live availability instantly, with weighted round-robin to favour your best closers and pause anyone who's out. Push every booking to your CRM via webhooks.",
    related: ["routing-form", "round-robin-scheduling", "meeting-distribution"],
    seeAlso: [{ label: "DayOtter for sales", href: "/for/sales" }],
  },
  {
    slug: "meeting-distribution",
    term: "Meeting distribution",
    category: "Teams",
    short:
      "How incoming meetings are shared across a team - evenly, by weight, or by availability - so no one is overloaded.",
    body: [
      "Meeting distribution describes the policy a team uses to allocate bookings: pure rotation, weighted rotation, or by who has the most open time. Good distribution keeps workloads fair, respects seniority or specialty, and adapts when someone is away.",
      "It's the umbrella concept behind round-robin, weighting and routing - the levers a team pulls to decide who takes what.",
    ],
    inDayOtter:
      "DayOtter distributes meetings by weighted round-robin, only ever to a host who is actually free, with per-member weights you can tune or zero out at any time.",
    related: ["round-robin-scheduling", "routing-form", "collective-availability"],
  },
  {
    slug: "group-poll",
    term: "Group poll",
    category: "Scheduling",
    short:
      "A quick vote on a few proposed times, letting a group pick the slot that works for the most people.",
    body: [
      "A group poll (or meeting poll) proposes several candidate times and lets each invitee mark which ones work. Once everyone's voted, you lock in the most-supported slot. It's the fastest way to schedule across a group when you can't require everyone at a fixed collective time.",
      "Polls shine for panels, committees and social plans - anywhere a rigid booking link is too much and an email thread is too little.",
    ],
    inDayOtter:
      "Propose a handful of times, share the poll, let people vote, and finalize the winner into a real booking with invites and reminders attached - no ads, on any plan.",
    related: ["collective-availability", "booking-page", "free-busy"],
    seeAlso: [{ label: "DayOtter vs Doodle", href: "/vs/doodle" }],
  },
  {
    slug: "booking-page",
    term: "Booking page",
    category: "Scheduling",
    short:
      "A shareable link that shows your real availability and lets people pick a time, creating a confirmed meeting on your calendar.",
    body: [
      "A booking page (or scheduling link) turns your calendar into a self-serve link. Someone opens it, sees only the times you're genuinely free, picks one, answers any intake questions, and the meeting is booked - with a video link, confirmation and reminders, no back-and-forth.",
      "Good booking pages carry branding, buffers, minimum notice, multiple durations and intake questions, so each kind of meeting gets its own rules.",
    ],
    inDayOtter:
      "DayOtter gives you unlimited branded booking pages free, each with buffers, notice, daily limits, intake questions and optional payment - all reading from your real, multi-calendar availability.",
    related: ["event-type", "buffer-time", "intake-form", "free-busy"],
    seeAlso: [{ label: "See all features", href: "/features" }],
  },
  {
    slug: "event-type",
    term: "Event type",
    category: "Scheduling",
    short:
      "A reusable meeting template - its length, location and rules - that people book from your page.",
    body: [
      "An event type (or booking type) is one kind of meeting you offer: a 30-minute intro, a paid 60-minute consult, a recurring weekly lesson. Each has its own duration, location, buffers, notice, intake questions and price. You make one per kind of meeting and share whichever links you like.",
      "Event types can be public (listed on your page) or private and one-off (shared only with the people you choose, sometimes expiring after a single use).",
    ],
    inDayOtter:
      "DayOtter supports unlimited event types on every plan, public or private, with per-type duration, location, buffers, limits, intake and payment - and Otter can create one for you by chat.",
    related: ["booking-page", "buffer-time", "recurring-booking", "intake-form"],
  },
  {
    slug: "buffer-time",
    term: "Buffer time",
    category: "Availability",
    short:
      "Padding automatically reserved before or after a meeting so bookings don't stack back-to-back.",
    body: [
      "Buffer time is breathing room the scheduler holds around each booking - five or ten minutes before to prepare, after to write notes or travel. Without buffers, a busy booking page packs meetings edge-to-edge and the day becomes unmanageable.",
      "Buffers are set per event type and applied automatically, so invitees simply never see the padded-out slots.",
    ],
    inDayOtter:
      "Set before and after buffers on any event type, plus minimum notice and travel buffers around in-person meetings - DayOtter removes the affected slots from your availability automatically.",
    related: ["event-type", "minimum-notice", "focus-time", "booking-page"],
  },
  {
    slug: "minimum-notice",
    term: "Minimum notice",
    category: "Availability",
    short:
      "The shortest lead time you'll accept a booking - so nobody can grab a slot five minutes from now.",
    body: [
      "Minimum notice (or scheduling notice) is the gap you require between now and the earliest bookable slot. Set it to a few hours or a day and last-minute bookings that would catch you off guard simply aren't offered.",
      "It's a small setting that quietly protects your day from ambush meetings.",
    ],
    inDayOtter:
      "Every DayOtter event type has a minimum-notice setting; slots inside the window are hidden from the booking page automatically.",
    related: ["buffer-time", "booking-page", "event-type"],
  },
  {
    slug: "free-busy",
    term: "Free/busy",
    category: "Availability",
    short:
      "The availability layer of a calendar - whether you're busy at a given time, without exposing the event details.",
    body: [
      "Free/busy is the privacy-preserving view of a calendar: it says a block is taken, not what it's for. Schedulers read free/busy across all your calendars to compute real availability, so a booking can never land on top of an existing commitment - while keeping the actual event details private.",
      "Combining free/busy from several accounts (work, personal, a shared team calendar) gives one honest picture of when you're truly open.",
    ],
    inDayOtter:
      "DayOtter reads free/busy from every connected calendar - Google, Outlook, Apple, ICS - to compute availability, and only ever sees that you're busy, never the details. Connection tokens are encrypted at rest.",
    related: ["calendar-sync", "booking-page", "collective-availability"],
    seeAlso: [{ label: "Integrations", href: "/integrations" }],
  },
  {
    slug: "calendar-sync",
    term: "Calendar sync",
    category: "Availability",
    short:
      "Keeping your scheduler and your calendars in agreement, both ways and in real time, so availability is always current.",
    body: [
      "Calendar sync reads your existing calendars for conflicts and writes new bookings back to them. Two-way, real-time sync means a meeting added anywhere - a colleague's invite, a personal appointment - instantly affects what your booking page offers, and every booking you take appears in the calendar you already live in.",
      "One-way or delayed sync is where double-bookings creep in; real-time two-way sync is what makes a scheduler trustworthy.",
    ],
    inDayOtter:
      "DayOtter syncs two-way in real time with Google and Microsoft 365 (via push notifications), Apple iCloud over CalDAV, and any ICS feed - writing bookings back with the right video link attached.",
    related: ["free-busy", "booking-page"],
    seeAlso: [{ label: "Integrations", href: "/integrations" }],
  },
  {
    slug: "focus-time",
    term: "Focus time",
    category: "Availability",
    short:
      "Blocks of the day deliberately protected for deep work, treated as real commitments that bookings can't override.",
    body: [
      "Focus time (or deep-work protection) reserves parts of your calendar for concentrated work and defends them from meetings. Rather than hoping a free afternoon survives, you hold it as a real block so the booking page won't offer it and colleagues can see you're occupied.",
      "The best focus-time tools find open windows for you and can reclaim time freed by a cancellation instead of just re-opening it for booking.",
    ],
    inDayOtter:
      "Ask Otter to hold focus blocks and it defends them as real events; adaptive availability caps meetings per day; and cancelled meetings can be reclaimed as focus time rather than re-offered - all confirm-first.",
    related: ["buffer-time", "confirm-first", "ai-scheduling-assistant"],
    seeAlso: [
      { label: "DayOtter vs Reclaim", href: "/vs/reclaim" },
      { label: "DayOtter vs Clockwise", href: "/vs/clockwise" },
    ],
  },
  {
    slug: "ai-scheduling-assistant",
    term: "AI scheduling assistant",
    category: "AI",
    short:
      "An assistant you ask in plain language to book, reschedule and protect time, which reads your real calendar to act.",
    body: [
      "An AI scheduling assistant turns natural language - typed or spoken - into calendar actions. Instead of clicking through forms, you say \"find 30 minutes with Priya next week\" or \"hold two hours tomorrow morning for the deck,\" and it drafts the change against your real availability.",
      "The trustworthy ones are confirm-first: they propose an editable action and wait for your approval rather than silently rearranging your day.",
    ],
    inDayOtter:
      "Otter is DayOtter's confirm-first assistant. It books, reschedules, creates event types, protects focus time and manages reminders - always as a draft you approve. Self-hosters add their own Anthropic API key to turn it on.",
    related: ["confirm-first", "focus-time", "voice-scheduling"],
    seeAlso: [{ label: "Ask Otter (docs)", href: "/docs/the-otter-assistant" }],
  },
  {
    slug: "confirm-first",
    term: "Confirm-first AI",
    category: "AI",
    short:
      "A design principle where the assistant proposes every change and waits for your approval - never acting on its own.",
    body: [
      "Confirm-first (or human-in-the-loop) means the AI drafts an action and shows it to you before anything happens. Nothing lands on your calendar, and nothing moves, without an explicit OK. It's the antidote to the unnerving experience of an auto-scheduler silently rearranging your week.",
      "Confirm-first keeps the speed of automation while leaving you in control - especially important for anything destructive, which should ask twice.",
    ],
    inDayOtter:
      "Every Otter action is an editable card you approve; destructive actions ask for a second confirmation. Otter proposes - you decide.",
    related: ["ai-scheduling-assistant", "focus-time"],
    seeAlso: [{ label: "DayOtter vs Motion", href: "/vs/motion" }],
  },
  {
    slug: "voice-scheduling",
    term: "Voice scheduling",
    category: "AI",
    short:
      "Speaking your scheduling requests aloud and having them turned into real calendar events.",
    body: [
      "Voice scheduling lets you capture a plan by talking - useful on mobile, on the move, or for anyone who thinks out loud faster than they type. You say what you need and the assistant transcribes it, understands it, and drafts the calendar changes.",
      "Paired with a confirm-first assistant, it's a quick way to get a thought onto the calendar before it slips away, without opening a single form.",
    ],
    inDayOtter:
      "On mobile, tap the mic and tell Otter what you need - it turns speech into scheduled events you confirm. DayOtter also has an AI voice receptionist that can answer calls and take bookings.",
    related: ["ai-scheduling-assistant", "confirm-first"],
    seeAlso: [{ label: "DayOtter for ADHD & busy minds", href: "/for/adhd" }],
  },
  {
    slug: "recurring-booking",
    term: "Recurring booking",
    category: "Scheduling",
    short:
      "Scheduling a repeating series - weekly, biweekly or monthly - in a single confirmation.",
    body: [
      "A recurring booking sets up a standing series in one go: a weekly coaching session, a biweekly check-in, a monthly review. Rather than re-booking the same slot over and over, one confirmation places the whole run on both calendars.",
      "It's essential for coaches, tutors and consultants whose relationships are ongoing rather than one-off.",
    ],
    inDayOtter:
      "Mark an event type recurring (weekly, biweekly or monthly) and a single booking schedules the entire series - pair it with prepaid session packages so clients pay once and draw down credits.",
    related: ["event-type", "prepaid-package", "booking-page"],
    seeAlso: [
      { label: "DayOtter for tutors", href: "/for/tutors" },
      { label: "DayOtter for consultants", href: "/for/consultants" },
    ],
  },
  {
    slug: "prepaid-package",
    term: "Prepaid session package",
    category: "Payments",
    short:
      "A bundle of sessions a client buys up front, then draws down one credit per booking.",
    body: [
      "A prepaid package (or session pack) sells several appointments at once - say ten lessons or a block of coaching hours. The client pays once, receives a balance of credits, and each booking consumes one. It smooths cash flow, rewards commitment, and removes per-session payment friction.",
      "Packages pair naturally with recurring bookings and paid consultations for anyone selling their time.",
    ],
    inDayOtter:
      "Connect Stripe, sell prepaid packages, and DayOtter tracks each client's credit balance - consuming one credit per booking, atomically, so balances never go wrong.",
    related: ["recurring-booking", "paid-booking", "event-type"],
    seeAlso: [{ label: "DayOtter for consultants", href: "/for/consultants" }],
  },
  {
    slug: "paid-booking",
    term: "Paid booking",
    category: "Payments",
    short:
      "Requiring payment or a deposit before a slot is confirmed - to reduce no-shows and get paid up front.",
    body: [
      "Paid bookings take money at the moment of scheduling: the full price of a consultation, or a deposit that holds the slot. It filters out flaky bookings, guarantees you're paid for your time, and turns your booking page into a lightweight checkout.",
      "Deposits are a gentle middle ground - enough commitment to deter no-shows without charging the whole fee up front.",
    ],
    inDayOtter:
      "Set a price or deposit on any event type and DayOtter takes payment through Stripe before the booking is confirmed. Free types stay free.",
    related: ["prepaid-package", "booking-page", "event-type"],
    seeAlso: [{ label: "Stripe integration", href: "/integrations/stripe" }],
  },
  {
    slug: "intake-form",
    term: "Intake form",
    category: "Scheduling",
    short:
      "Questions asked at booking time so you show up to the meeting already prepared.",
    body: [
      "An intake form collects context before the meeting - what the person wants to discuss, an account number, a link to review. Answers arrive with the booking, so you walk in prepared instead of spending the first ten minutes getting oriented.",
      "For qualification, the same questions can also drive routing - sending the booking to the right person based on the answers.",
    ],
    inDayOtter:
      "Add custom intake questions to any event type; answers are attached to the booking and can feed a routing form to send the meeting to the right person.",
    related: ["routing-form", "event-type", "booking-page"],
  },
];

export function getGlossaryTerm(slug: string): GlossaryTerm | undefined {
  return GLOSSARY.find((t) => t.slug === slug);
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Scheduling",
  "Teams",
  "Availability",
  "AI",
  "Payments",
];
