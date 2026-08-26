import { randomUUID } from "node:crypto";
import { primaryOrg } from "@/lib/billing/entitlements";
import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { logger } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { getOrCreatePersonalEventType } from "./host-booking";
import { reminderOffsetsForHost, scheduleBookingReminders } from "./reminders";
import { teamSchedule } from "./team-schedule";

export interface InternalTeamBookingInput {
  teamId: string;
  /** The team member organising the meeting (always a host). */
  organizerId: string;
  title: string;
  start: Date;
  durationMinutes: number;
  /** User ids of the teammates to include (the organiser is always added). */
  memberIds: string[];
  /** External invitee emails. */
  guests?: string[];
  notes?: string;
  timezone: string;
}

export interface TeamBookingConflict {
  name: string;
}

export interface InternalTeamBookingResult {
  uid: string;
  hostCount: number;
  /** Members who were busy at that time (the meeting overrides them anyway). */
  conflicts: TeamBookingConflict[];
}

interface TeamMemberRow {
  userId: string;
  internalBookable: boolean;
  user: { id: string; name: string | null; email: string; timezone: string | null } | null;
}

/**
 * Which members a conflict check / booking should span: the organiser plus the
 * requested teammates, restricted to internal-bookable members of the team.
 * Returns null if the organiser isn't on the team.
 */
export function resolveInternalHosts(
  members: TeamMemberRow[],
  organizerId: string,
  requestedMemberIds: string[],
): TeamMemberRow[] | null {
  if (!members.some((m) => m.userId === organizerId)) return null;
  const requested = new Set([organizerId, ...requestedMemberIds]);
  return members.filter(
    (m) => requested.has(m.userId) && (m.userId === organizerId || m.internalBookable) && m.user,
  );
}

/** Members busy at [start, end), for a privacy-safe "these people are busy" note. */
export async function internalTeamBookingConflicts(
  hosts: TeamMemberRow[],
  start: Date,
  end: Date,
): Promise<TeamBookingConflict[]> {
  const schedule = await teamSchedule(
    hosts.map((h) => ({
      userId: h.userId,
      name: h.user?.name ?? h.user?.email ?? "Member",
      email: h.user?.email ?? "",
    })),
    start,
    end,
  );
  const conflicts: TeamBookingConflict[] = [];
  for (const member of schedule) {
    // A booking that ends exactly when this one starts isn't a conflict.
    if (member.intervals.some((i) => i.start.getTime() < end.getTime() && i.end > start)) {
      conflicts.push({ name: member.name });
    }
  }
  return conflicts;
}

/**
 * Create an INTERNAL team booking: a teammate schedules a meeting across chosen
 * members, knowingly overriding anyone who's busy (allow_overlap = true, so the
 * no-double-book guards don't reject it). The organiser hosts the row; every
 * selected member is recorded in booking_hosts and gets the event on their
 * calendar. Returns the booking uid plus which members had a clash.
 */
export async function createInternalTeamBooking(
  input: InternalTeamBookingInput,
): Promise<InternalTeamBookingResult | null> {
  const db = getDb();
  const end = new Date(input.start.getTime() + input.durationMinutes * 60_000);

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, input.teamId),
    with: { members: { with: { user: true } } },
  });
  if (!team) return null;

  const hosts = resolveInternalHosts(
    team.members as unknown as TeamMemberRow[],
    input.organizerId,
    input.memberIds,
  );
  if (!hosts || hosts.length === 0) return null;

  const conflicts = await internalTeamBookingConflicts(hosts, input.start, end);

  const org = await primaryOrg(input.organizerId);
  if (!org) return null;
  const eventTypeId = await getOrCreatePersonalEventType(input.organizerId, org.id);

  const guests = (input.guests ?? []).filter((e) => e.includes("@"));
  const uid = randomUUID();

  const booking = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(schema.bookings)
      .values({
        organizationId: org.id,
        eventTypeId,
        hostId: input.organizerId,
        title: input.title,
        description: input.notes,
        startsAt: input.start,
        endsAt: end,
        timezone: input.timezone,
        status: "confirmed",
        // Internal override: the team knowingly booked through commitments.
        allowOverlap: true,
        uid,
      })
      .returning();
    if (!row) return null;

    await tx
      .insert(schema.bookingHosts)
      .values(hosts.map((h) => ({ bookingId: row.id, userId: h.userId })))
      .onConflictDoNothing();

    if (guests.length > 0) {
      await tx
        .insert(schema.bookingAttendees)
        .values(guests.map((email) => ({ bookingId: row.id, email, timezone: input.timezone })));
    }
    return row;
  });
  if (!booking) return null;

  // Put the meeting on every host's calendar (best-effort), with the other hosts
  // + external guests as attendees. Reminders go to the organiser.
  for (const host of hosts) {
    const others = hosts
      .filter((h) => h.userId !== host.userId)
      .map((h) => ({ email: h.user?.email ?? "", name: h.user?.name ?? undefined }))
      .filter((a) => a.email);
    await writeBookingToCalendar(host.userId, {
      title: input.title,
      description: input.notes ?? undefined,
      start: input.start,
      end,
      timezone: input.timezone,
      attendees: [...others, ...guests.map((email) => ({ email }))],
    }).catch((err) =>
      logger.error("internal team booking calendar write failed", {
        event: "internal_team_booking_calendar_failed",
        userId: host.userId,
        err,
      }),
    );
  }

  await scheduleBookingReminders(
    booking.id,
    input.start,
    await reminderOffsetsForHost(input.organizerId),
  );

  return { uid, hostCount: hosts.length, conflicts };
}
