/** Local blog content. Add a post here and it appears on /blog + /blog/[slug]. */

export interface BlogBlock {
  heading?: string;
  paragraphs: string[];
}
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO
  author: string;
  readMinutes: number;
  body: BlogBlock[];
}

export const POSTS: BlogPost[] = [
  {
    slug: "meet-otter-assistant",
    title: "Meet Otter, the assistant that runs your calendar",
    excerpt:
      "Chat or talk to Otter and it books, moves, blocks, and rearranges your week - but only ever with your say-so. Here’s what your calendar’s new copilot can do.",
    date: "2026-07-12",
    author: "The DayOtter team",
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          "Scheduling is death by a thousand tiny chores: find a slot, block the prep time, move the thing that clashes, remember to tell the attendees. Otter - the assistant built into your DayOtter dashboard - does those chores for you. You just chat with it, or talk to it.",
        ],
      },
      {
        heading: "Ask in plain language",
        paragraphs: [
          "“Move my 3pm to Friday morning.” “Find me a free hour this week for deep work.” “Block two hours tomorrow afternoon.” Otter reads your real availability across every connected calendar and turns the request into a concrete change - no menus, no forms.",
          "Tap the mic and it works hands-free: speak the request, and Otter can read the answer back to you.",
        ],
      },
      {
        heading: "It actually does things",
        paragraphs: [
          "Otter goes beyond answering questions. It can create a new booking type, hold focus time, adjust your working hours, change your timezone, set up reminder channels, and manage your automations - the things that normally take five screens of clicking. Anything you can do in DayOtter, Otter can do; it’s just faster.",
        ],
      },
      {
        heading: "Confirm-first, always",
        paragraphs: [
          "It never acts on its own. Every change shows up as an editable card you approve with a tap, and anything destructive asks twice before it happens. You get the speed of automation without ever losing the wheel.",
          "Self-hosting? Otter turns on when you add your own AI key. On the cloud, it’s ready the moment you sign in.",
        ],
      },
    ],
  },
  {
    slug: "one-link-no-back-and-forth",
    title: "One link, and the back-and-forth is over",
    excerpt:
      "“Does Tuesday work? How about Thursday at 2 - oh, my 2 just moved.” Share one DayOtter link instead and let people pick a time you’re actually free.",
    date: "2026-07-10",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "Booking a meeting over email is a tennis match nobody wants to win. Every volley is another round of “when are you free?” against a calendar that keeps changing under you.",
        ],
      },
      {
        heading: "Share a link, not your week",
        paragraphs: [
          "Send one DayOtter link. The other person opens your page, sees only the times you’re genuinely open, and picks one. It lands on both calendars with a video link attached - no accounts, no reply thread, no “actually, that just filled up.”",
        ],
      },
      {
        heading: "Shaped exactly how you work",
        paragraphs: [
          "Set up a booking type for each kind of meeting - a 15-minute intro, a 60-minute deep dive - with buffers before and after, minimum notice, a daily cap, and intake questions so you show up prepared. Meet over Google Meet, Zoom, phone, or in person.",
          "Need a single meeting without opening your whole calendar? Generate a one-off link that expires after it’s used. Booking someone important? Keep the type private and share it only with them.",
        ],
      },
    ],
  },
  {
    slug: "confirm-first-ai",
    title: "AI that proposes, never disposes",
    excerpt:
      "Calendar AI has a trust problem: it moves your meetings without asking. DayOtter takes a different stance - confirm-first, always.",
    date: "2026-07-06",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "The promise of AI scheduling is seductive: let software optimize your week. The reality is often unsettling - you open your calendar and something has quietly moved.",
        ],
      },
      {
        heading: "Propose, then confirm",
        paragraphs: [
          "DayOtter’s AI is confirm-first. Ask it to move your 3pm to tomorrow, or to defend two hours of deep work, and it drafts an editable proposal. Nothing touches your calendar until you say so.",
          "It stays strictly in scope, too - scheduling only. It won’t wander off to summarize your inbox or draft your strategy deck. It does one job, and it asks before it acts.",
        ],
      },
      {
        heading: "The best of both",
        paragraphs: [
          "You get the leverage of automation without surrendering control of your time. That’s the whole point: software that respects your calendar enough to ask first.",
        ],
      },
    ],
  },
  {
    slug: "every-calendar-one-truth",
    title: "Every calendar, one source of truth",
    excerpt:
      "Work Google, personal iCloud, a shared Outlook - DayOtter reads them all, so you’re never offered a time you’re secretly busy.",
    date: "2026-07-04",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "Most double-bookings come from the calendar you forgot to check. The work one knows about the standup; the personal one knows about the dentist; neither knows about the other. DayOtter is the layer that does.",
        ],
      },
      {
        heading: "Connect once, stay honest",
        paragraphs: [
          "Link Google, Outlook, and iCloud - plus any read-only calendar feed. Before DayOtter ever offers a slot, it checks every connected calendar for a conflict. If you’re busy anywhere, that time simply isn’t on the table.",
        ],
      },
      {
        heading: "Busy, not private",
        paragraphs: [
          "DayOtter sees that you’re busy, never why. The details of your meetings stay on your own calendars; only free/busy shapes your availability. Connection tokens are encrypted at rest, and nothing you put in is ever sold.",
        ],
      },
      {
        heading: "Write where you want",
        paragraphs: [
          "Pick exactly which calendar new bookings are written to, and keep the others read-only just for conflict checks. One place decides when you’re free; you decide where the events land.",
        ],
      },
    ],
  },
  {
    slug: "adaptive-availability",
    title: "Stop letting a full day get fuller",
    excerpt:
      "Back-to-back is not a badge of honor. Adaptive availability quietly protects your worst days - here’s how.",
    date: "2026-07-02",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "The cruel math of open booking links: the busier you are, the more you get booked. A day that’s already packed keeps taking hits until there’s no room to think.",
        ],
      },
      {
        heading: "A cap that thinks for you",
        paragraphs: [
          "Adaptive availability sets a ceiling on meetings per day. Once a day hits your cap - counting both DayOtter bookings and events on your connected calendars - DayOtter simply stops offering slots that day. No awkward decline emails, no manual blocking.",
          "Pair it with travel-time buffers and automated focus blocks, and your calendar starts defending itself. You set the rules once; DayOtter enforces them every time someone tries to book.",
        ],
      },
    ],
  },
  {
    slug: "reminders-that-land",
    title: "Reminders that actually get there",
    excerpt:
      "The best reminder is the one someone reads. DayOtter sends them where people already are - email, SMS, WhatsApp, and push.",
    date: "2026-06-27",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "No-show isn’t usually rudeness. It’s an email that got buried under forty others by 9am. The fix isn’t nagging harder - it’s reaching people on the channel they actually check.",
        ],
      },
      {
        heading: "Meet people where they are",
        paragraphs: [
          "Email reminders are always on. Add Slack, SMS, WhatsApp, mobile push, or browser push on top - for you and for the people you’re meeting. A gentle nudge lands before the meeting, wherever it’ll get seen.",
        ],
      },
      {
        heading: "Timed the way you like",
        paragraphs: [
          "Choose the lead times that fit - a day before to plan, an hour before to get moving. Set it once and every booking inherits it. Fewer no-shows, far less chasing.",
        ],
      },
    ],
  },
  {
    slug: "calendar-on-autopilot",
    title: "Put your calendar on autopilot",
    excerpt:
      "Prep blocks, buffers, follow-ups, focus time - the routine calendar admin you keep meaning to do, handled automatically.",
    date: "2026-06-20",
    author: "The DayOtter team",
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          "The meeting itself is the easy part. It’s the scaffolding around it - the prep, the buffer, the follow-up, the focus time you meant to protect - that quietly eats your week. DayOtter builds that scaffolding for you.",
        ],
      },
      {
        heading: "Automations",
        paragraphs: [
          "Set rules that fire on their own: add a prep block before every sales call, a buffer after long meetings, or a weekly focus window you never have to remember to book. Configure it once; DayOtter applies it every time.",
        ],
      },
      {
        heading: "Workflows",
        paragraphs: [
          "Send attendees the right message at the right moment automatically - a reminder the night before, a thank-you and next steps after - scoped to just the booking types you choose. It reads like you wrote it, without you writing it each time.",
        ],
      },
      {
        heading: "Defenses that hold",
        paragraphs: [
          "Layer on focus blocks, travel-time buffers around in-person meetings, a protected lunch, and adaptive daily caps. Bit by bit, your calendar stops being a free-for-all and starts guarding the time that matters.",
        ],
      },
    ],
  },
  {
    slug: "team-scheduling-without-the-spreadsheet",
    title: "Team scheduling without the spreadsheet",
    excerpt:
      "Round-robin the sales team, find a time everyone’s free, or share one raft of availability - without the shared-calendar headache.",
    date: "2026-06-14",
    author: "The DayOtter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "Scheduling for one person is a solved problem. Scheduling across a team is where most tools fall back on a spreadsheet and a group chat. DayOtter keeps it to a single link.",
        ],
      },
      {
        heading: "Collective and round-robin",
        paragraphs: [
          "A collective booking type finds a slot when everyone required is free. A round-robin type spreads incoming bookings across the team so no one person carries them all. One link either way - DayOtter picks the right host and the right time.",
        ],
      },
      {
        heading: "One shared view",
        paragraphs: [
          "See the whole team’s free/busy for the week in a single place, and set team rules - holidays, no-meeting windows - that every member’s links quietly respect. Otters raft up so the current can’t pull them apart; your team’s calendars do the same.",
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
