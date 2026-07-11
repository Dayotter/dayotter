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
    slug: "why-open-source-scheduling",
    title: "Why scheduling should be open source",
    excerpt:
      "Your calendar is a map of your life. Here's why the software that reads it should be open — and what that means for dayotter.",
    date: "2026-07-08",
    author: "The dayotter team",
    readMinutes: 4,
    body: [
      {
        paragraphs: [
          "Every scheduling tool asks for the same thing: full access to your calendar. That's a lot of trust to hand a black box. We think the software that reads your most sensitive data should be software you can read back.",
        ],
      },
      {
        heading: "Trust you can verify",
        paragraphs: [
          "Open source means you can audit exactly how your data is handled — how tokens are stored, what leaves your server, and what doesn't. With dayotter, OAuth tokens are encrypted at rest and we never sell your data. But you don't have to take our word for it; the code is right there.",
          "It also means you're never locked in. Don't like where the hosted product is going? Run it yourself. Your data, your servers, every feature.",
        ],
      },
      {
        heading: "Open core, sustainably",
        paragraphs: [
          "Free-and-open doesn't have to mean unsustainable. dayotter is open-core: the whole scheduling engine — including the advanced features — is free when you self-host. Our hosted cloud funds the work with a simple $9/seat Pro plan and a couple of managed-only extras.",
          "That balance keeps the lights on without holding the core hostage. It's the model that's worked for the tools developers actually trust.",
        ],
      },
    ],
  },
  {
    slug: "confirm-first-ai",
    title: "AI that proposes, never disposes",
    excerpt:
      "Calendar AI has a trust problem: it moves your meetings without asking. dayotter takes a different stance — confirm-first, always.",
    date: "2026-07-06",
    author: "The dayotter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "The promise of AI scheduling is seductive: let software optimize your week. The reality is often unsettling — you open your calendar and something has quietly moved.",
        ],
      },
      {
        heading: "Propose, then confirm",
        paragraphs: [
          "dayotter's AI is confirm-first. Ask it to move your 3pm to tomorrow, or to defend two hours of deep work, and it drafts an editable proposal. Nothing touches your calendar until you say so.",
          "It stays strictly in scope, too — scheduling only. It won't wander off to summarize your inbox or draft your strategy deck. It does one job, and it asks before it acts.",
        ],
      },
      {
        heading: "The best of both",
        paragraphs: [
          "You get the leverage of automation without surrendering control of your time. That's the whole point: software that respects your calendar enough to ask first.",
        ],
      },
    ],
  },
  {
    slug: "adaptive-availability",
    title: "Stop letting a full day get fuller",
    excerpt:
      "Back-to-back is not a badge of honor. Adaptive availability quietly protects your worst days — here's how.",
    date: "2026-07-02",
    author: "The dayotter team",
    readMinutes: 3,
    body: [
      {
        paragraphs: [
          "The cruel math of open booking links: the busier you are, the more you get booked. A day that's already packed keeps taking hits until there's no room to think.",
        ],
      },
      {
        heading: "A cap that thinks for you",
        paragraphs: [
          "Adaptive availability sets a ceiling on meetings per day. Once a day hits your cap — counting both dayotter bookings and events on your connected calendars — dayotter simply stops offering slots that day. No awkward decline emails, no manual blocking.",
          "Pair it with travel-time buffers and automated focus blocks, and your calendar starts defending itself. You set the rules once; dayotter enforces them every time someone tries to book.",
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
