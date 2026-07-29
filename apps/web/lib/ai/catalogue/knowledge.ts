/**
 * The Otter knowledge catalogue - a small, curated set of reference documents
 * the assistant can retrieve to ground how-to and best-practice answers.
 *
 * This is DayOtter-specific product knowledge written for grounding, not
 * marketing: how a capability actually works and how to get the best out of it.
 * Otter reaches it through the `search_knowledge` tool - when a host asks "how
 * do I..." or "what's the best way to...", the model pulls the matching
 * article(s) into context and answers from them instead of guessing.
 *
 * Retrieval is keyword + title overlap (a handful of short docs needs nothing
 * heavier than that). Keep each article concise, accurate to what the product
 * actually does, and free of anything that would go stale quickly.
 */

export interface KnowledgeArticle {
  id: string;
  title: string;
  /** Extra match terms beyond the title/body words (synonyms, feature names). */
  keywords: string[];
  /** The grounded reference text handed to the model. */
  body: string;
}

export const KNOWLEDGE_ARTICLES: KnowledgeArticle[] = [
  {
    id: "focus-time",
    title: "Protecting focus and deep-work time",
    keywords: [
      "focus",
      "deep work",
      "heads down",
      "block time",
      "protect",
      "concentration",
      "busy",
    ],
    body: `DayOtter can hold focus time so nobody books over it. Ask for what you need ("block 4 hours before Friday", "protect my mornings") and Otter finds concrete open blocks that are already clear of meetings and synced-calendar busy time, then holds them as focus blocks. Held focus blocks count as busy in your availability, so booking pages stop offering those slots. For recurring protection, set a weekly automation rule. Best practice: protect focus in the morning before meetings pile up, and keep blocks to 60-120 minutes so they're easy to place.`,
  },
  {
    id: "no-shows",
    title: "Reducing no-shows and late cancellations",
    keywords: ["no-show", "no show", "cancellation", "reminder", "confirm", "attendance", "flake"],
    body: `The biggest levers on no-shows are reminders and confirmations. Add reminder channels (email is on by default; Slack, SMS and WhatsApp can be added) so invitees get nudged before the meeting. Require confirmation on high-value booking types so a slot is only held once the guest confirms. Add a short buffer before meetings so back-to-back overruns don't cascade. For paid meetings, a deposit sharply cuts no-shows. You can also set up a workflow that emails guests a day before with the details and a reschedule link.`,
  },
  {
    id: "availability",
    title: "Working hours, days off, and out-of-office",
    keywords: [
      "availability",
      "working hours",
      "hours",
      "day off",
      "vacation",
      "out of office",
      "ooo",
      "away",
      "date override",
      "time off",
      "holiday",
    ],
    body: `Your default availability is a weekly grid of working hours in your timezone. Change it with a request like "set my hours to 9-5, Monday to Friday". For one-off changes (a single day off, or extra hours on a specific date) use a date override rather than editing the weekly grid. For a stretch of days away, set an out-of-office period with a start and end date; while you're away DayOtter shows an "away" banner on your booking page and, if you name a delegate you share a team with, redirects new bookings to them. Out-of-office and date overrides both block bookable time automatically.`,
  },
  {
    id: "booking-types",
    title: "Designing booking types",
    keywords: [
      "booking type",
      "event type",
      "meeting type",
      "duration",
      "buffer",
      "limit",
      "group",
      "capacity",
      "access code",
      "price",
    ],
    body: `A booking type is a shareable meeting template: title, URL slug, duration, and location (Google Meet, Teams, Zoom, phone, in person, or custom). Tune it with buffers before/after, a minimum notice window, a booking window (how far ahead people can book), and daily or weekly limits to cap how many land per period. Group types allow multiple attendees up to a capacity. Add an access code to keep a type semi-private, or mark it private so it's link-only. Keep durations short by default - a 25 or 50 minute option leaves natural buffers.`,
  },
  {
    id: "automations-workflows",
    title: "Automations vs workflows",
    keywords: [
      "automation",
      "workflow",
      "rule",
      "prep",
      "buffer",
      "follow-up",
      "followup",
      "email",
      "trigger",
      "reminder",
    ],
    body: "Two different tools. Automations act on YOUR calendar: when a booking is created they can auto-add a prep block before it, a buffer after it, or a follow-up block; weekly automations can protect a recurring window. Workflows act on your GUESTS: they send templated emails a set time before or after the meeting (reminders, prep instructions, thank-you and next-steps notes), scoped to all or specific booking types. Rule of thumb: reach for an automation to protect your own time, a workflow to communicate with attendees.",
  },
  {
    id: "calendars",
    title: "Connecting calendars and conflict checking",
    keywords: [
      "calendar",
      "google",
      "outlook",
      "microsoft",
      "apple",
      "icloud",
      "caldav",
      "sync",
      "conflict",
      "connect",
      "two-way",
    ],
    body: "Connect Google, Microsoft/Outlook, or Apple (CalDAV) calendars so DayOtter sees your real commitments. Each connected calendar can be toggled for conflict checking - busy events on those calendars block bookable slots, so you never get double-booked across tools. Confirmed DayOtter bookings are written back to your primary calendar (two-way), and mirrored events are de-duplicated so a booking never shows up twice. Connecting more than one calendar is the core advantage: DayOtter treats all of them as one combined schedule.",
  },
  {
    id: "teams",
    title: "Team scheduling and round-robin",
    keywords: [
      "team",
      "round robin",
      "round-robin",
      "collective",
      "delegate",
      "member",
      "assign",
      "distribute",
    ],
    body: `Create a team and add members (they need a DayOtter account). Team booking types can distribute meetings round-robin across members based on availability and priority, so load spreads evenly. Collective types require several members to be free at once. Delegates matter for time off: when you set an out-of-office period you can redirect new bookings to a teammate you share a team with, so coverage continues while you're away.`,
  },
];

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "how",
  "what",
  "can",
  "does",
  "the",
  "best",
  "way",
  "set",
  "get",
  "use",
  "make",
  "add",
  "put",
  "have",
  "want",
  "need",
  "this",
  "that",
  "from",
  "into",
  "about",
  "when",
  "should",
  "would",
  "could",
  "will",
  "are",
  "was",
  "our",
  "all",
  "any",
  "not",
  "but",
  "off",
  "out",
]);

/** Content terms of a query: lowercased words length ≥ 3 minus stopwords. */
function terms(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

export interface KnowledgeMatch {
  id: string;
  title: string;
  body: string;
  score: number;
}

/**
 * Rank the knowledge base against a query by keyword + title overlap. Title and
 * explicit keyword hits weigh more than body hits. Returns the top `limit`
 * scoring articles (score > 0), best first. Pure - unit-tested.
 */
export function searchKnowledge(query: string, limit = 2): KnowledgeMatch[] {
  const q = terms(query);
  if (q.length === 0) return [];
  return KNOWLEDGE_ARTICLES.map((a) => {
    const title = a.title.toLowerCase();
    const keywordHay = a.keywords.join(" ").toLowerCase();
    const body = a.body.toLowerCase();
    let score = 0;
    for (const t of q) {
      if (title.includes(t)) score += 3;
      if (keywordHay.includes(t)) score += 2;
      else if (body.includes(t)) score += 1;
    }
    return { id: a.id, title: a.title, body: a.body, score };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
