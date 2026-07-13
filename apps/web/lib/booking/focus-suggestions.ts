import { eq, getDb, schema } from "@dayotter/db";
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
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  for (const s of slots) {
    const key = dayKey(s.start);
    if (seenDays.has(key)) continue;
    seenDays.add(key);
    suggestions.push({ startISO: s.start.toISOString(), endISO: s.end.toISOString() });
    if (suggestions.length >= 5) break;
  }
  return suggestions;
}

export interface FocusBlock {
  startISO: string;
  durationMinutes: number;
  /** Human label in the host's timezone, e.g. "Tue, Jul 14 · 9:00–10:30 AM". */
  label: string;
}

/**
 * Auto-scheduling core: pick concrete, non-overlapping open blocks that add up
 * toward `hoursNeeded`, honouring an optional deadline. This is what lets Otter
 * "protect 6 hours of focus this week" or "find 4 hours for the deck by Friday"
 * in one shot — it does the finding; the user confirms before anything is held.
 * Returns the chosen blocks (never writes). At most 2 blocks per day so a single
 * request can't swallow a whole day.
 */
export async function findFocusBlocks(
  userId: string,
  opts: { hoursNeeded?: number; chunkMinutes?: number; days?: number; byDate?: Date | null } = {},
): Promise<FocusBlock[]> {
  const chunkMinutes = Math.min(240, Math.max(30, Math.round(opts.chunkMinutes ?? 90)));
  const hoursNeeded = Math.min(40, Math.max(0.25, opts.hoursNeeded ?? 1.5));
  const days = Math.min(30, Math.max(1, opts.days ?? 7));

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { timezone: true },
  });
  const tz = user?.timezone ?? "UTC";

  const now = new Date();
  let end = new Date(now.getTime() + days * 86_400_000);
  if (
    opts.byDate &&
    opts.byDate.getTime() > now.getTime() &&
    opts.byDate.getTime() < end.getTime()
  ) {
    end = opts.byDate;
  }

  const slots = await hostSlots(
    userId,
    null,
    {
      durationMinutes: chunkMinutes,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      minimumNoticeMinutes: 60,
      slotIntervalMinutes: 30,
      bookingWindowDays: days,
    },
    now,
    end,
  );

  const dayFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });
  const dayKeyOf = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const target = hoursNeeded * 60;
  const perDay = new Map<string, number>();
  const chosen: FocusBlock[] = [];
  let total = 0;
  let lastEndMs = 0;

  for (const s of slots) {
    if (total >= target) break;
    // Skip blocks that overlap one we've already taken (hostSlots emits
    // overlapping candidates every slot-interval).
    if (s.start.getTime() < lastEndMs) continue;
    const key = dayKeyOf(s.start);
    if ((perDay.get(key) ?? 0) >= 2) continue;

    chosen.push({
      startISO: s.start.toISOString(),
      durationMinutes: chunkMinutes,
      label: `${dayFmt.format(s.start)} · ${timeFmt.format(s.start)}–${timeFmt.format(s.end)}`,
    });
    perDay.set(key, (perDay.get(key) ?? 0) + 1);
    total += chunkMinutes;
    lastEndMs = s.end.getTime();
  }
  return chosen;
}
