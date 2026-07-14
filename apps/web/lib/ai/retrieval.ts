import { and, asc, eq, getDb, gte, schema } from "@dayotter/db";

/**
 * Lightweight retrieval ("RAG-lite") for the scheduling assistant. Rather than
 * dumping the user's entire calendar into every prompt, we assemble a compact,
 * *relevant* snapshot: the bookings most likely to be what the user is talking
 * about (by keyword overlap and by recency) plus the event types they might
 * want to schedule. Smaller prompts are faster, cheaper, and more accurate.
 *
 * No vector store - a calendar is small and time-anchored, so keyword + recency
 * selection is the right tool. The retrieved list is the source of truth for
 * booking references, so the caller resolves the model's ref against it.
 */

export interface RetrievedBooking {
  /** Capability token / public id - used to act on the booking after confirm. */
  uid: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  /** Attendee display names (or emails) for matching "the call with Dana". */
  attendees: string[];
}

export interface RetrievedEventType {
  title: string;
  slug: string;
  durationMinutes: number;
}

export interface CalendarContext {
  timezone: string;
  /** Relevance + recency selected, in chronological order. */
  bookings: RetrievedBooking[];
  eventTypes: RetrievedEventType[];
}

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "you",
  "your",
  "can",
  "please",
  "move",
  "cancel",
  "reschedule",
  "book",
  "meeting",
  "call",
  "set",
  "make",
  "add",
  "put",
  "have",
  "want",
  "need",
  "tomorrow",
  "today",
  "next",
  "this",
  "that",
  "from",
  "into",
  "get",
  "let",
  "now",
  "new",
  "one",
  "all",
  "any",
  "our",
]);

/** Query terms worth matching on - lowercased words of length ≥ 3, minus stopwords. */
function terms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  ];
}

/** How many query terms appear in a booking's title or attendee names. */
function score(booking: RetrievedBooking, queryTerms: string[]): number {
  if (queryTerms.length === 0) return 0;
  const hay = `${booking.title} ${booking.attendees.join(" ")}`.toLowerCase();
  return queryTerms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
}

/**
 * Pure selection: union of the soonest few bookings (time anchor, so "my 3pm"
 * resolves) and the best keyword matches ("the call with Dana"), capped at
 * `limit` and returned in chronological order. Exported for unit testing.
 */
export function selectRelevantBookings(
  all: RetrievedBooking[],
  query: string,
  limit: number,
): RetrievedBooking[] {
  const queryTerms = terms(query);
  const anchorCount = Math.min(6, limit);
  const selected = new Map<string, RetrievedBooking>();

  // 1. Soonest few - the time anchor (assumes `all` is already chronological).
  for (const b of all.slice(0, anchorCount)) selected.set(b.uid, b);

  // 2. Best keyword matches - fill the rest, highest score first.
  const ranked = all
    .map((b) => ({ b, s: score(b, queryTerms) }))
    .filter((x) => x.s > 0)
    .sort((a, z) => z.s - a.s);
  for (const { b } of ranked) {
    if (selected.size >= limit) break;
    selected.set(b.uid, b);
  }

  return [...selected.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}

/**
 * Build the assistant's working context for a request. Selects relevant bookings
 * (see `selectRelevantBookings`) and the event types the user might schedule.
 */
export async function retrieveCalendarContext(
  userId: string,
  query: string,
  opts: { limit?: number } = {},
): Promise<CalendarContext> {
  const limit = opts.limit ?? 12;
  const db = getDb();

  const [user, upcoming, eventTypeRows] = await Promise.all([
    db.query.users.findFirst({ where: eq(schema.users.id, userId), columns: { timezone: true } }),
    db.query.bookings.findMany({
      where: and(
        eq(schema.bookings.hostId, userId),
        eq(schema.bookings.status, "confirmed"),
        gte(schema.bookings.startsAt, new Date()),
      ),
      orderBy: asc(schema.bookings.startsAt),
      limit: 60,
      with: { attendees: { columns: { name: true, email: true } } },
    }),
    db.query.eventTypes.findMany({
      where: and(eq(schema.eventTypes.ownerId, userId), eq(schema.eventTypes.isActive, true)),
      columns: { title: true, slug: true, durationMinutes: true },
      limit: 30,
    }),
  ]);

  const all: RetrievedBooking[] = upcoming.map((b) => ({
    uid: b.uid,
    title: b.title,
    startsAt: b.startsAt,
    endsAt: b.endsAt,
    attendees: b.attendees.map((a) => a.name ?? a.email),
  }));

  const bookings = selectRelevantBookings(all, query, limit);

  // Event types: keyword-relevant first, then the rest, capped small.
  const etTerms = terms(query);
  const eventTypes = eventTypeRows
    .map((e) => ({
      e,
      s: etTerms.length ? etTerms.filter((t) => e.title.toLowerCase().includes(t)).length : 0,
    }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ e }) => e);

  return { timezone: user?.timezone ?? "UTC", bookings, eventTypes };
}
