/**
 * The Otter prompt catalogue - a curated, categorized library of things the
 * assistant is genuinely good at, phrased the way a host would actually ask.
 *
 * It serves two audiences at once:
 *  1. The HOST - rendered as suggestion chips in the assistant UI, so people
 *     discover what Otter can do instead of staring at a blank box.
 *  2. The MODEL - `capabilitySummary()` distills the catalogue into a compact
 *     block injected into Otter's system prompt, so it knows its own surface and
 *     maps fuzzy requests onto the right tool.
 *
 * Keep every prompt to something Otter can actually do with a tool it has. If a
 * capability lands, add a prompt here - this is the single source of truth for
 * "what can I ask Otter?".
 */

export type PromptCategory = "plan" | "focus" | "meetings" | "availability" | "setup" | "insights";

export interface CataloguePrompt {
  /** Stable id (analytics + React keys). */
  id: string;
  category: PromptCategory;
  /** Short label for a suggestion chip. */
  label: string;
  /** The full text sent to Otter when the host taps the chip. */
  prompt: string;
}

export interface CatalogueCategory {
  key: PromptCategory;
  /** Human title for the group header. */
  title: string;
  /** One-line description of what this cluster of prompts is for. */
  blurb: string;
}

export const PROMPT_CATEGORIES: CatalogueCategory[] = [
  { key: "plan", title: "Plan your day", blurb: "See what's ahead across all your calendars." },
  { key: "focus", title: "Protect focus time", blurb: "Carve out and hold deep-work blocks." },
  { key: "meetings", title: "Manage meetings", blurb: "Book, move, cancel, and find open time." },
  {
    key: "availability",
    title: "Availability & time off",
    blurb: "Working hours, days off, and out-of-office.",
  },
  { key: "setup", title: "Set up & automate", blurb: "Booking types, reminders, and workflows." },
  { key: "insights", title: "Insights", blurb: "How your time and bookings are trending." },
];

export const PROMPT_CATALOGUE: CataloguePrompt[] = [
  // ---- Plan your day ----
  {
    id: "plan-today",
    category: "plan",
    label: "What's on today?",
    prompt: "What's on my calendar today?",
  },
  {
    id: "plan-week",
    category: "plan",
    label: "How busy is this week?",
    prompt: "How busy is my week? Give me a day-by-day rundown.",
  },
  {
    id: "plan-next",
    category: "plan",
    label: "When's my next meeting?",
    prompt: "When's my next meeting, and who's it with?",
  },
  {
    id: "plan-day",
    category: "plan",
    label: "What does Thursday look like?",
    prompt: "What does Thursday look like?",
  },

  // ---- Protect focus time ----
  {
    id: "focus-hours",
    category: "focus",
    label: "Block 4h of focus",
    prompt: "Block 4 hours of focus time for me before Friday.",
  },
  {
    id: "focus-mornings",
    category: "focus",
    label: "Protect my mornings",
    prompt: "Protect my mornings this week for deep work.",
  },
  {
    id: "focus-deck",
    category: "focus",
    label: "Find time for the deck",
    prompt: "I need 3 hours for the deck by Thursday - find and hold the time.",
  },
  {
    id: "focus-lunch",
    category: "focus",
    label: "Hold lunch every day",
    prompt: "Hold 12–1 for lunch every weekday.",
  },

  // ---- Manage meetings ----
  {
    id: "meet-free30",
    category: "meetings",
    label: "Find a free 30 min",
    prompt: "Find me a free 30 minutes this afternoon.",
  },
  {
    id: "meet-move",
    category: "meetings",
    label: "Move my 3pm",
    prompt: "Move my 3pm to tomorrow morning.",
  },
  {
    id: "meet-cancel",
    category: "meetings",
    label: "Cancel a meeting",
    prompt: "Cancel my last meeting on Friday.",
  },
  {
    id: "meet-find",
    category: "meetings",
    label: "Find the call with…",
    prompt: "Find my upcoming call with Dana.",
  },

  // ---- Availability & time off ----
  {
    id: "avail-free",
    category: "availability",
    label: "Am I free Friday 2pm?",
    prompt: "Am I free on Friday at 2pm?",
  },
  {
    id: "avail-ooo",
    category: "availability",
    label: "Set me out of office",
    prompt: "Set me out of office next Monday through Wednesday.",
  },
  {
    id: "avail-hours",
    category: "availability",
    label: "Change my working hours",
    prompt: "Change my working hours to 9am–5pm, Monday to Friday.",
  },

  // ---- Set up & automate ----
  {
    id: "setup-type",
    category: "setup",
    label: "Create a booking type",
    prompt: "Create a 30-minute intro call booking type.",
  },
  {
    id: "setup-followup",
    category: "setup",
    label: "Add a follow-up email",
    prompt: "Send a follow-up email one day after every meeting.",
  },
  {
    id: "setup-slack",
    category: "setup",
    label: "Remind me on Slack",
    prompt: "Remind me on Slack before my meetings.",
  },
  {
    id: "setup-buffer",
    category: "setup",
    label: "Add buffers after calls",
    prompt: "Give me a 15-minute buffer after every booking.",
  },

  // ---- Insights ----
  {
    id: "insights-count",
    category: "insights",
    label: "Meetings last week?",
    prompt: "How many meetings did I have last week?",
  },
  {
    id: "insights-conversion",
    category: "insights",
    label: "Booking conversion",
    prompt: "What's my booking-page conversion this month?",
  },
];

/** Prompts in a given category, in catalogue order. */
export function promptsByCategory(category: PromptCategory): CataloguePrompt[] {
  return PROMPT_CATALOGUE.filter((p) => p.category === category);
}

/**
 * A compact capability summary for Otter's system prompt: one line per category
 * with a few real example phrasings. Teaches the model the shape of what it can
 * do so it maps vague asks onto the right tool instead of declining.
 */
export function capabilitySummary(): string {
  const lines = PROMPT_CATEGORIES.map((cat) => {
    const examples = promptsByCategory(cat.key)
      .slice(0, 3)
      .map((p) => `"${p.prompt}"`)
      .join(", ");
    return `- ${cat.title} - ${cat.blurb} e.g. ${examples}`;
  });
  return `Things hosts commonly ask you for (map fuzzy requests onto these):\n${lines.join("\n")}`;
}
