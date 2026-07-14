/**
 * Audience ("for X") landing content, rendered at /for/[slug]. Same template
 * for each persona: the pain they feel, how DayOtter fits, how it works, an FAQ.
 * Tailor the language to the reader - name their specific problem plainly.
 */

export interface Persona {
  slug: string;
  /** Short label for nav/cards, e.g. "Founders". */
  label: string;
  title: string;
  subtitle: string;
  /** Why generic scheduling fails this person - 3 concrete pains. */
  problems: { title: string; body: string }[];
  /** Why DayOtter fits - 4 tailored capabilities. */
  solutions: { title: string; body: string }[];
  /** Three plain steps. */
  steps: string[];
  faq: { q: string; a: string }[];
}

export const PERSONAS: Persona[] = [
  {
    slug: "founders",
    label: "Founders",
    title: "The scheduling assistant for founders who'd rather build than book.",
    subtitle:
      "Talk your week into place, protect deep work, and let investors and candidates book you - without the calendar becoming a second job.",
    problems: [
      {
        title: "Calendar admin is a tax you don't notice",
        body: "Five minutes here, ten there - by Friday you've spent an hour tending tools instead of talking to customers.",
      },
      {
        title: "Deep work keeps getting eaten",
        body: "Meetings creep in and the real work never gets a block. By end of week you're not sure where the time went.",
      },
      {
        title: "The back-and-forth never ends",
        body: '"Does Tuesday work?" "How about Thursday?" Every intro call costs three emails you don\'t have time for.',
      },
    ],
    solutions: [
      {
        title: "Say it, Otter books it",
        body: '"Investor call Tuesday 2pm, 45 minutes." One line, one confirm. Otter drafts it and never touches your calendar without your OK.',
      },
      {
        title: "Deep work, defended",
        body: "Ask Otter to hold two hours a morning for building - it treats them as real events, not soft suggestions.",
      },
      {
        title: "One link for everyone",
        body: "Share a booking page so candidates, investors and customers grab a slot themselves - buffers and video links included.",
      },
      {
        title: "Free, and yours",
        body: "Free for you, $9/seat when the team grows, and open-source if you'd rather self-host. No enterprise sales call.",
      },
    ],
    steps: [
      "Connect Google, Outlook or iCloud - Otter learns when you're actually free.",
      "Tell Otter what to hold and share your booking link.",
      "Confirm the drafts. Get back to building.",
    ],
    faq: [
      {
        q: "Will it move my calendar around on its own?",
        a: "Never. Otter proposes; you approve. Nothing changes without your confirmation.",
      },
      {
        q: "Is it really free for a solo founder?",
        a: "Yes - unlimited event types, calendar sync, group polls and reminders, free forever. Pay only when you add teammates.",
      },
    ],
  },
  {
    slug: "teams",
    label: "Teams",
    title: "Scheduling your whole team can actually run on.",
    subtitle:
      "Round-robin that's fair, routing that sends people to the right person, and shared availability - without a per-seat tax that punishes growth.",
    problems: [
      {
        title: "Round-robin isn't really fair",
        body: "Most tools spread meetings evenly whether or not that's what you want. You can't weight your senior reps or pause someone who's out.",
      },
      {
        title: "Inbound lands on the wrong desk",
        body: "Enterprise leads and quick questions hit the same link, so the wrong person spends time on the wrong meeting.",
      },
      {
        title: "Team scheduling costs a fortune",
        body: "The features you actually need sit behind $16–20/seat tiers that get expensive the moment you grow.",
      },
    ],
    solutions: [
      {
        title: "Weighted round-robin",
        body: "Distribute meetings by weight - book your closers more, pause anyone who's away - and it stays load-balanced automatically.",
      },
      {
        title: "Routing forms",
        body: "Ask a couple of questions up front, then send each visitor to the right person or event type. No lead lands in the wrong place.",
      },
      {
        title: "Collective & shared availability",
        body: "Find a time everyone's free for panels and group calls, across every connected calendar.",
      },
      {
        title: "Fair pricing",
        body: "$9/seat for the whole toolkit - half of Calendly - or self-host every feature for free.",
      },
    ],
    steps: [
      "Add your team and connect everyone's calendars.",
      "Set weights, build a routing form, share the link.",
      "Meetings land on the right person, every time.",
    ],
    faq: [
      {
        q: "Can I weight round-robin or pause someone?",
        a: "Yes. Each member has a weight you can change any time; set it to 0 to pause them from the rotation.",
      },
      {
        q: "How does routing decide where a booking goes?",
        a: 'You write simple rules - "if they pick Enterprise, send them to sales" - checked top to bottom, with a fallback. It\'s all no-code.',
      },
    ],
  },
  {
    slug: "consultants",
    label: "Consultants & coaches",
    title: "Booking, rescheduling and payments - handled, so you can do the work.",
    subtitle:
      "Let clients book recurring sessions, take payment up front, and let Otter handle the reschedules - all on a page that looks like you.",
    problems: [
      {
        title: "Recurring clients, manual booking",
        body: "Standing weekly sessions mean re-booking the same slot over and over, and chasing anyone who drifts.",
      },
      {
        title: "No-shows and late payers",
        body: "Free bookings get flaky. Without a deposit, a missed session is just lost income.",
      },
      {
        title: "The reschedule shuffle",
        body: '"Can we move to Thursday?" turns into a thread - and sometimes a double-booking.',
      },
    ],
    solutions: [
      {
        title: "Recurring sessions in one booking",
        body: "Offer a weekly or biweekly series - one confirmation books the whole run, on your calendar and theirs.",
      },
      {
        title: "Take payment to book",
        body: "Charge the full price or a deposit through Stripe before a slot is held. Fewer no-shows, paid up front.",
      },
      {
        title: "Otter handles the changes",
        body: '"Move my 3pm to Thursday." Otter finds the slot and reschedules - you just confirm.',
      },
      {
        title: "A page that's yours",
        body: "Your name, your colour, your intake questions, your buffers. Calm and professional, not a generic form.",
      },
    ],
    steps: [
      "Create a booking type - set duration, price and whether it recurs.",
      "Share your link; clients book (and pay) themselves.",
      "Let Otter handle reschedules and reminders.",
    ],
    faq: [
      {
        q: "Can clients book a recurring series?",
        a: "Yes - mark a booking type as recurring (weekly, biweekly or monthly) and one booking schedules the whole series.",
      },
      {
        q: "Can I charge for sessions?",
        a: "Yes - connect Stripe and require full payment or a deposit before a booking is confirmed.",
      },
    ],
  },
  {
    slug: "recruiters",
    label: "Recruiters",
    title: "Interview scheduling without the coordination headache.",
    subtitle:
      "Route candidates to the right interviewer, find a time across a panel, and share one link - so hiring loops move in hours, not days.",
    problems: [
      {
        title: "Panel scheduling is a puzzle",
        body: "Finding one slot that works for three interviewers and a candidate can take a dozen messages.",
      },
      {
        title: "Candidates hit the wrong interviewer",
        body: "A backend role and a design role share the same link, so people land with the wrong person.",
      },
      {
        title: "Loops stall over timezones",
        body: "Candidate in one timezone, panel in another - and every reschedule risks a double-booking.",
      },
    ],
    solutions: [
      {
        title: "Group polls to find a time",
        body: "Propose a few slots, let the panel and candidate vote, and lock in the winner - no back-and-forth thread.",
      },
      {
        title: "Routing to the right interviewer",
        body: "A short form sends each candidate to the right role and interviewer automatically.",
      },
      {
        title: "Weighted round-robin",
        body: "Spread first-round screens fairly across your team, weighted and load-balanced, pausing anyone who's out.",
      },
      {
        title: "Timezone-safe by default",
        body: "Every candidate sees times in their own timezone; you never do the mental math.",
      },
    ],
    steps: [
      "Set up interviewers, routing and round-robin weights.",
      "Share the link - or send a poll for panel loops.",
      "Confirm; everyone gets the invite and reminders.",
    ],
    faq: [
      {
        q: "How do I schedule a panel interview?",
        a: "Use a group poll: propose a few times, the panel and candidate vote, and you finalize the most-supported slot into a booking.",
      },
      {
        q: "Can I route candidates by role?",
        a: "Yes - a routing form asks a question or two and sends each candidate to the right interviewer or event type.",
      },
    ],
  },
  {
    slug: "agencies",
    label: "Agencies",
    title: "Client scheduling that doesn't eat your billable hours.",
    subtitle:
      "Let clients book the right person on your team, keep every account's meetings straight, and hand the back-and-forth to Otter - so your hours go to the work, not the calendar.",
    problems: [
      {
        title: "Booking eats billable time",
        body: "Every client call starts with a scheduling thread. Multiply that across accounts and it's days a month you can't invoice.",
      },
      {
        title: "Clients reach the wrong person",
        body: "A new-business enquiry and a project check-in hit the same link, so the wrong person fields the wrong call.",
      },
      {
        title: "Every account juggles its own calendar",
        body: "Account leads, designers and devs each have their own availability, and lining them up for a client review is a puzzle.",
      },
    ],
    solutions: [
      {
        title: "One link, routed to the right team",
        body: "A short routing form sends new business, support and project calls to the right person or pod automatically.",
      },
      {
        title: "Weighted round-robin across the team",
        body: "Spread discovery calls fairly across account managers, weight your leads, and pause anyone at capacity.",
      },
      {
        title: "Collective booking for reviews",
        body: "Find a slot that works for the client and everyone on the project in one go, across all your calendars.",
      },
      {
        title: "Otter runs the back-and-forth",
        body: '"Move the Acme review to Thursday." Otter finds the time and reschedules - you confirm and get back to the work.',
      },
    ],
    steps: [
      "Add your team and connect everyone's calendars.",
      "Build a routing form and set round-robin weights per pod.",
      "Share one link - clients book the right person, every time.",
    ],
    faq: [
      {
        q: "Can different clients book different people?",
        a: "Yes - a routing form asks a question or two and sends each client to the right account lead, pod or event type.",
      },
      {
        q: "Does it handle our whole team's availability?",
        a: "Yes. Collective and round-robin booking look across every connected calendar, so client meetings only land when the right people are actually free.",
      },
    ],
  },
  {
    slug: "sales",
    label: "Sales teams",
    title: "Turn inbound into booked meetings - instantly, on the right rep.",
    subtitle:
      "Qualify and route leads the moment they land, distribute meetings fairly with weighted round-robin, and cut the no-shows - so your pipeline moves faster.",
    problems: [
      {
        title: "Speed-to-lead is killing you",
        body: "A lead fills a form, then waits for a rep to email back. By the time you reply, they've cooled - or booked a competitor.",
      },
      {
        title: "Leads land on the wrong rep",
        body: "Enterprise and SMB hit the same link, so your closers spend time on deals that were never theirs.",
      },
      {
        title: "Round-robin isn't really fair",
        body: "Meetings get spread evenly whether or not that's right - you can't book your top closers more or pause someone who's out.",
      },
    ],
    solutions: [
      {
        title: "Qualify and book on the spot",
        body: "A routing form scores the lead and drops them straight onto the right rep's live availability - no reply-and-wait.",
      },
      {
        title: "Weighted round-robin",
        body: "Send more meetings to your best closers, weight by territory or segment, and pause anyone who's away - always load-balanced.",
      },
      {
        title: "Fewer no-shows",
        body: "Automated reminders over email, SMS and Slack - plus optional deposits - keep booked meetings booked.",
      },
      {
        title: "Wired into your stack",
        body: "Push every booking to your tools with webhooks and our API, so the rest of your stack stays in sync.",
      },
    ],
    steps: [
      "Build a routing form that qualifies inbound.",
      "Set round-robin weights across your reps.",
      "Share the link - qualified leads book the right rep instantly.",
    ],
    faq: [
      {
        q: "How fast can a lead book after filling the form?",
        a: "Immediately - the routing form sends a qualified lead straight to the right rep's live availability, so there's no reply-and-wait gap.",
      },
      {
        q: "Can I weight meetings toward my best reps?",
        a: "Yes - each rep has a weight you can tune by performance, territory or segment, and set to zero to pause anyone who's out.",
      },
      {
        q: "Does it connect to our CRM?",
        a: "You can push every booking to your stack today via webhooks and our API. Native Salesforce and HubSpot sync is on our roadmap.",
      },
    ],
  },
  {
    slug: "adhd",
    label: "ADHD & busy minds",
    title: "Scheduling that works with your brain, not against it.",
    subtitle:
      "Brain-dump it out loud, let Otter turn it into a plan, and get gentle nudges instead of a wall of overdue tasks. Built for minds that juggle a lot.",
    problems: [
      {
        title: "Getting started is the hardest part",
        body: "Opening the calendar, picking a time, doing the timezone math - the setup cost alone is enough to make you put it off.",
      },
      {
        title: "Time blindness eats the day",
        body: "Meetings sneak up, focus time never gets protected, and by evening you're not sure where the hours actually went.",
      },
      {
        title: "Planners become guilt machines",
        body: "A screen full of overdue tasks doesn't help - it just makes you want to close the app and avoid it.",
      },
    ],
    solutions: [
      {
        title: "Just say it - Otter does the setup",
        body: '"Book the dentist and hold an hour to prep the deck." Say it once; Otter turns it into real calendar events. No forms, no friction.',
      },
      {
        title: "Focus time, actually protected",
        body: "Ask Otter to hold blocks for deep work and it defends them as real events - so the day has room for the hard stuff, not just meetings.",
      },
      {
        title: "Gentle nudges, not a pile of red",
        body: "Reminders when they matter - plus a running-late ping to your next meeting - instead of a growing list of things you've failed to do.",
      },
      {
        title: "One calm surface",
        body: "No forty settings to configure. Connect a calendar, talk to Otter, and get on with your day.",
      },
    ],
    steps: [
      "Connect your calendar - Otter learns when you're actually free.",
      "Brain-dump by voice or text; Otter turns it into events you confirm.",
      "Get nudged at the right moment. Nothing slips, nothing shames.",
    ],
    faq: [
      {
        q: "Is this actually different from a to-do app?",
        a: "Yes - instead of a list you have to maintain, you talk to Otter and it puts real, time-boxed events on your calendar, then reminds you at the right moment. Less managing, more doing.",
      },
      {
        q: "Will it nag me?",
        a: "No. Otter is confirm-first and quiet by default - it nudges when something's genuinely coming up, and never buries you in overdue-task guilt.",
      },
      {
        q: "Can I just talk to it?",
        a: "Yes. On mobile, tap the mic and say what you need - Otter turns speech into scheduled events, so you can capture a thought before it's gone.",
      },
    ],
  },
];

export function getPersona(slug: string): Persona | undefined {
  return PERSONAS.find((p) => p.slug === slug);
}
