import { eq, getDb, schema } from "@calsync/db";
import { hostSlots } from "./availability";

export interface FocusSuggestion {
  startISO: string;
  endISO: string;
}

/**
 * Suggest protectable deep-work blocks: the earliest free block of `blockMinutes`
 * on each of the next few working days, computed from the user's schedule minus
 * their real busy times. Confirm-first — these are proposals; nothing is written
 * until the user protects one.
 */
export async function deepWorkSuggestions(
  userId: string,
  opts: { days?: number; blockMinutes?: number } = {},
): Promise<FocusSuggestion[]> {
  const days = opts.days ?? 7;
  const blockMinutes = opts.blockMinutes ?? 90;

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";

  const now = new Date();
  const end = new Date(now.getTime() + days * 86_400_000);

  const slots = await hostSlots(
    userId,
    null,
    {
      durationMinutes: blockMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minimumNoticeMinutes: 60,
      slotIntervalMinutes: 30,
      bookingWindowDays: days,
    },
    now,
    end,
  );

  // Keep the earliest free block per local calendar day (one suggestion/day).
  const seenDays = new Set<string>();
  const suggestions: FocusSuggestion[] = [];
  const dayKey = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

  for (const s of slots) {
    const key = dayKey(s.start);
    if (seenDays.has(key)) continue;
    seenDays.add(key);
    suggestions.push({ startISO: s.start.toISOString(), endISO: s.end.toISOString() });
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}
