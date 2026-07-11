import {
  type EventConstraints,
  type Slot,
  computeAvailability,
  intersectAvailability,
} from "@dayotter/core";
import { and, eq, getDb, gte, inArray, lte, ne, schema, sql } from "@dayotter/db";
import { DateTime } from "luxon";
import { recommendedSlots } from "./rank-slots";

/** Keep only group slots that still have a free seat. Pure — unit-tested. */
export function filterOpenGroupSlots(
  slots: Slot[],
  counts: Map<number, number>,
  capacity: number,
): Slot[] {
  return slots.filter((s) => (counts.get(s.start.getTime()) ?? 0) < capacity);
}

/**
 * Daily lunch-break intervals across [rangeStart, rangeEnd] at the given
 * wall-clock minutes, in the schedule's timezone (DST-correct via `.set`).
 */
export function lunchIntervals(
  startMinute: number,
  endMinute: number,
  tz: string,
  rangeStart: Date,
  rangeEnd: Date,
): { start: Date; end: Date }[] {
  if (endMinute <= startMinute) return [];
  const set = { second: 0, millisecond: 0 } as const;
  const out: { start: Date; end: Date }[] = [];
  const last = DateTime.fromJSDate(rangeEnd).setZone(tz).endOf("day");
  let day = DateTime.fromJSDate(rangeStart).setZone(tz).startOf("day");
  for (; day <= last; day = day.plus({ days: 1 })) {
    out.push({
      start: day
        .set({ hour: Math.floor(startMinute / 60), minute: startMinute % 60, ...set })
        .toJSDate(),
      end: day.set({ hour: Math.floor(endMinute / 60), minute: endMinute % 60, ...set }).toJSDate(),
    });
  }
  return out;
}

type EventTypeRow = typeof schema.eventTypes.$inferSelect;

/** ±window used when re-validating that a chosen instant is actually offered. */
export const SLOT_REVALIDATION_WINDOW_MS = 12 * 3_600_000;

/** Map an event type's booking constraints for the availability engine. */
export function eventConstraints(eventType: EventTypeRow): EventConstraints {
  return {
    durationMinutes: eventType.durationMinutes,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    minimumNoticeMinutes: eventType.minimumNoticeMinutes,
    slotIntervalMinutes: eventType.slotIntervalMinutes ?? undefined,
    bookingWindowDays: eventType.bookingWindowDays ?? undefined,
  };
}

/** Minutes of free time to enforce around the host's own bookings (0 = none). */
function gapFor(eventType: EventTypeRow): number {
  return eventType.minimumGapMinutes ?? 0;
}

/**
 * Combine per-host slot arrays for an event type. Pure — no I/O — so it's unit
 * tested directly:
 * - individual → the single host's slots
 * - collective → intersection (every host free)
 * - round_robin → union, deduped by start time
 */
export function combineHostSlots(
  perHost: Slot[][],
  schedulingType: "individual" | "collective" | "round_robin",
): Slot[] {
  if (perHost.length === 0) return [];
  if (perHost.length === 1) return perHost[0] ?? [];
  if (schedulingType === "collective") return intersectAvailability(perHost);

  const seen = new Set<number>();
  const union: Slot[] = [];
  for (const slots of perHost) {
    for (const s of slots) {
      const k = s.start.getTime();
      if (!seen.has(k)) {
        seen.add(k);
        union.push(s);
      }
    }
  }
  return union.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Compute one host's bookable slots: their schedule minus their calendar
 * busy-times and existing confirmed bookings. `scheduleId` overrides the host's
 * default schedule (used for individual event types that pin a schedule).
 */
export async function hostSlots(
  userId: string,
  scheduleId: string | null,
  event: EventConstraints,
  rangeStart: Date,
  rangeEnd: Date,
  gapMinutes = 0,
  excludeBookingId?: string,
  /** For a group event type: don't let its own shared-slot bookings self-block. */
  ignoreGroupEventTypeId?: string,
): Promise<Slot[]> {
  const db = getDb();

  // Schedule + calendar connections don't depend on each other — fetch together.
  const [schedule, connections] = await Promise.all([
    scheduleId
      ? db.query.schedules.findFirst({
          where: eq(schema.schedules.id, scheduleId),
          with: { availabilityRules: true, dateOverrides: true },
        })
      : db.query.schedules.findFirst({
          where: and(eq(schema.schedules.userId, userId), eq(schema.schedules.isDefault, true)),
          with: { availabilityRules: true, dateOverrides: true },
        }),
    db.query.calendarConnections.findMany({
      where: eq(schema.calendarConnections.userId, userId),
      with: { calendars: true },
    }),
  ]);
  if (!schedule) return [];

  const calendarIds = connections
    .flatMap((c) => c.calendars)
    .filter((cal) => cal.checkForConflicts)
    .map((cal) => cal.id);

  const [busyRows, existingBookings, blocks, prefs] = await Promise.all([
    calendarIds.length ? busyBlocksFor(calendarIds, rangeStart, rangeEnd) : Promise.resolve([]),
    bookingsFor([userId], rangeStart, rangeEnd, excludeBookingId, ignoreGroupEventTypeId),
    timeBlocksFor(userId, rangeStart, rangeEnd),
    getDb().query.userPreferences.findFirst({
      where: eq(schema.userPreferences.userId, userId),
      columns: {
        adaptiveAvailability: true,
        maxMeetingsPerDay: true,
        lunchEnabled: true,
        lunchStartMinute: true,
        lunchEndMinute: true,
      },
    }),
  ]);

  const ownBookings = existingBookings.filter((b) => b.hostId === userId);
  // A daily lunch break blocks time like any other busy interval.
  const lunchBusy = prefs?.lunchEnabled
    ? lunchIntervals(
        prefs.lunchStartMinute,
        prefs.lunchEndMinute,
        schedule.timezone,
        rangeStart,
        rangeEnd,
      )
    : [];
  const slots = computeAvailability({
    schedule: {
      timezone: schedule.timezone,
      rules: schedule.availabilityRules.map((r) => ({
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      overrides: schedule.dateOverrides.map((o) => ({
        date: o.date,
        startTime: o.startTime,
        endTime: o.endTime,
      })),
    },
    busy: [
      ...busyRows.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      // First-class personal / focus time blocks also block availability.
      ...blocks.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      // Pad the host's OWN bookings by the minimum gap so back-to-back slots
      // aren't offered (external calendar events are not padded).
      ...ownBookings.map((b) => ({
        start: new Date(b.startsAt.getTime() - gapMinutes * 60_000),
        end: new Date(b.endsAt.getTime() + gapMinutes * 60_000),
      })),
      // Daily lunch break.
      ...lunchBusy,
    ],
    event,
    rangeStart,
    rangeEnd,
    now: new Date(),
  });

  // Adaptive availability: on days already at/over the meeting cap, stop offering
  // slots so a heavy day doesn't get heavier. Counts real meetings (own bookings +
  // external opaque events), not personal blocks.
  if (prefs?.adaptiveAvailability) {
    const cap = prefs.maxMeetingsPerDay ?? 5;
    const perDay = new Map<string, number>();
    const key = (d: Date) => {
      const dt = new Date(d);
      // Group by the schedule's local calendar day.
      return dt.toLocaleDateString("en-CA", { timeZone: schedule.timezone });
    };
    for (const b of ownBookings)
      perDay.set(key(b.startsAt), (perDay.get(key(b.startsAt)) ?? 0) + 1);
    for (const b of busyRows) perDay.set(key(b.startsAt), (perDay.get(key(b.startsAt)) ?? 0) + 1);
    return slots.filter((s) => (perDay.get(key(s.start)) ?? 0) < cap);
  }

  return slots;
}

/** The user's personal / focus blocks overlapping the window. */
function timeBlocksFor(userId: string, rangeStart: Date, rangeEnd: Date) {
  return getDb().query.timeBlocks.findMany({
    where: and(
      eq(schema.timeBlocks.userId, userId),
      lte(schema.timeBlocks.startsAt, rangeEnd),
      gte(schema.timeBlocks.endsAt, rangeStart),
    ),
    columns: { startsAt: true, endsAt: true },
  });
}

/** Busy blocks that OVERLAP the window (not just those that start inside it — a
 * long meeting starting before rangeStart still blocks the window's opening). */
function busyBlocksFor(calendarIds: string[], rangeStart: Date, rangeEnd: Date) {
  return getDb().query.busyBlocks.findMany({
    where: and(
      inArray(schema.busyBlocks.calendarId, calendarIds),
      lte(schema.busyBlocks.startsAt, rangeEnd),
      gte(schema.busyBlocks.endsAt, rangeStart),
    ),
    columns: { startsAt: true, endsAt: true },
  });
}

function bookingsFor(
  hostIds: string[],
  rangeStart: Date,
  rangeEnd: Date,
  excludeBookingId?: string,
  ignoreGroupEventTypeId?: string,
) {
  return getDb().query.bookings.findMany({
    where: and(
      inArray(schema.bookings.hostId, hostIds),
      eq(schema.bookings.status, "confirmed"),
      gte(schema.bookings.endsAt, rangeStart),
      lte(schema.bookings.startsAt, rangeEnd),
      // When re-validating a reschedule, the booking being moved must not count
      // itself as busy (it would falsely reject nearby/overlapping new slots).
      excludeBookingId ? ne(schema.bookings.id, excludeBookingId) : undefined,
      // A group event type's own shared-slot bookings must not block its slots —
      // capacity is what closes them (see filterOpenGroupSlots).
      ignoreGroupEventTypeId
        ? sql`NOT (${schema.bookings.eventTypeId} = ${ignoreGroupEventTypeId} AND ${schema.bookings.isGroup} = true)`
        : undefined,
    ),
    columns: { hostId: true, startsAt: true, endsAt: true },
  });
}

/** Confirmed seat counts per group slot (keyed by start-instant ms). */
async function groupSlotCounts(
  eventTypeId: string,
  rangeStart: Date,
  rangeEnd: Date,
): Promise<Map<number, number>> {
  const rows = await getDb()
    .select({ startsAt: schema.bookings.startsAt, n: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(
      and(
        eq(schema.bookings.eventTypeId, eventTypeId),
        eq(schema.bookings.status, "confirmed"),
        eq(schema.bookings.isGroup, true),
        gte(schema.bookings.startsAt, rangeStart),
        lte(schema.bookings.startsAt, rangeEnd),
      ),
    )
    .groupBy(schema.bookings.startsAt);
  return new Map(rows.map((r) => [r.startsAt.getTime(), r.n]));
}

/** The user ids who host an event type (owner for individual; hosts for team). */
export async function eventTypeHostIds(eventType: EventTypeRow): Promise<string[]> {
  if (eventType.ownerId) return [eventType.ownerId];
  const hosts = await getDb().query.eventTypeHosts.findMany({
    where: eq(schema.eventTypeHosts.eventTypeId, eventType.id),
  });
  return hosts.map((h) => h.userId);
}

/**
 * Per-host bookable slots for an event type, in a stable host order. Computed
 * once here so callers (the availability API and the booking host-resolver)
 * don't recompute it. Individual events pin the owner's schedule.
 */
export async function eventTypeHostSlots(
  eventType: EventTypeRow,
  rangeStart: Date,
  rangeEnd: Date,
  durationOverride?: number,
): Promise<{ hostIds: string[]; perHost: Slot[][] }> {
  const base = eventConstraints(eventType);
  // Multiple durations: recompute slots for the booker's chosen (allowed) length.
  const event = durationOverride ? { ...base, durationMinutes: durationOverride } : base;
  const gap = gapFor(eventType);

  if (eventType.ownerId) {
    const capacity = eventType.maxAttendees ?? 1;
    const isGroup = capacity > 1;
    const slots = await hostSlots(
      eventType.ownerId,
      eventType.scheduleId,
      event,
      rangeStart,
      rangeEnd,
      gap,
      undefined,
      isGroup ? eventType.id : undefined,
    );
    if (isGroup) {
      const counts = await groupSlotCounts(eventType.id, rangeStart, rangeEnd);
      return {
        hostIds: [eventType.ownerId],
        perHost: [filterOpenGroupSlots(slots, counts, capacity)],
      };
    }
    return { hostIds: [eventType.ownerId], perHost: [slots] };
  }

  const hostIds = await eventTypeHostIds(eventType);
  const perHost = await Promise.all(
    hostIds.map((id) => hostSlots(id, null, event, rangeStart, rangeEnd, gap)),
  );
  return { hostIds, perHost };
}

/** True when `duration` is a valid booking length for this event type. */
export function isAllowedDuration(eventType: EventTypeRow, duration: number): boolean {
  const options = eventType.durationOptions ?? [];
  if (options.length > 0) return options.includes(duration);
  return duration === eventType.durationMinutes;
}

/**
 * Bookable slots for any event type. Individual → the owner's slots.
 * Collective → the intersection of all hosts' slots (everyone free).
 * Round-robin → the union (at least one host free).
 */
export async function getEventTypeAvailability(
  eventTypeId: string,
  rangeStart: Date,
  rangeEnd: Date,
  durationOverride?: number,
): Promise<Slot[] | null> {
  const eventType = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, eventTypeId),
  });
  if (!eventType) return null;

  // Honor a requested duration only if the event type allows it.
  const duration =
    durationOverride && isAllowedDuration(eventType, durationOverride)
      ? durationOverride
      : undefined;
  const { perHost } = await eventTypeHostSlots(eventType, rangeStart, rangeEnd, duration);
  return combineHostSlots(perHost, eventType.schedulingType);
}

/** The host's real commitments (own bookings + external busy + focus blocks) in a window. */
async function hostCommitments(userId: string, rangeStart: Date, rangeEnd: Date) {
  const connections = await getDb().query.calendarConnections.findMany({
    where: eq(schema.calendarConnections.userId, userId),
    with: { calendars: true },
  });
  const calendarIds = connections
    .flatMap((c) => c.calendars)
    .filter((cal) => cal.checkForConflicts)
    .map((cal) => cal.id);

  const [bookings, busy, blocks] = await Promise.all([
    bookingsFor([userId], rangeStart, rangeEnd),
    calendarIds.length ? busyBlocksFor(calendarIds, rangeStart, rangeEnd) : Promise.resolve([]),
    timeBlocksFor(userId, rangeStart, rangeEnd),
  ]);
  return [...bookings, ...busy, ...blocks].map((b) => ({ start: b.startsAt, end: b.endsAt }));
}

/**
 * Smart-scheduling: pick the top recommended slots for an event type from an
 * already-computed slot list. Only for individual (owner) event types — team
 * scheduling has no single host whose day we're consolidating. Returns the
 * recommended slots' ISO start instants (a subset of `slots`).
 */
export async function recommendSlotsForEventType(
  eventTypeId: string,
  slots: Slot[],
  max = 3,
): Promise<string[]> {
  if (slots.length === 0) return [];
  const eventType = await getDb().query.eventTypes.findFirst({
    where: eq(schema.eventTypes.id, eventTypeId),
  });
  if (!eventType?.ownerId) return [];

  // Time-of-day scoring uses the governing schedule's timezone.
  const schedule = eventType.scheduleId
    ? await getDb().query.schedules.findFirst({
        where: eq(schema.schedules.id, eventType.scheduleId),
        columns: { timezone: true },
      })
    : await getDb().query.schedules.findFirst({
        where: and(
          eq(schema.schedules.userId, eventType.ownerId),
          eq(schema.schedules.isDefault, true),
        ),
        columns: { timezone: true },
      });

  const rangeStart = slots[0]!.start;
  const rangeEnd = slots[slots.length - 1]!.end;
  const commitments = await hostCommitments(eventType.ownerId, rangeStart, rangeEnd);

  const recommended = recommendedSlots(slots, commitments, {
    timezone: schedule?.timezone ?? "UTC",
    now: new Date(),
    gapMinutes: gapFor(eventType),
    max,
  });
  return recommended.map((s) => s.start.toISOString());
}
