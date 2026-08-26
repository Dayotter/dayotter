import { getSession } from "@/lib/auth/session";
import {
  createInternalTeamBooking,
  internalTeamBookingConflicts,
  resolveInternalHosts,
} from "@/lib/booking/internal-team-booking";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  title: z.string().min(1).max(200),
  // Accept an offset (the client sends a local ISO with its zone offset).
  startISO: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int().min(5).max(1440),
  /** Teammates to include (the organiser is always added server-side). */
  memberIds: z.array(z.string().uuid()).max(50).default([]),
  guests: z.array(z.string().email()).max(20).optional(),
  notes: z.string().max(2000).optional(),
  /** Just report who's busy at that time; don't create anything. */
  dryRun: z.boolean().optional(),
});

/**
 * Internal team booking: a team member schedules a meeting across chosen
 * teammates, overriding anyone who's busy. Any member may organise one.
 * `dryRun: true` returns the conflict preview without booking.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const db = getDb();

  const membership = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
    columns: { id: true },
  });
  if (!membership) return NextResponse.json({ error: "Not a team member" }, { status: 403 });

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Check the meeting details" }, { status: 400 });
  const d = parsed.data;
  const start = new Date(d.startISO);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }
  const timezone =
    (
      await db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: { timezone: true },
      })
    )?.timezone ?? "UTC";

  if (d.dryRun) {
    const team = await db.query.teams.findFirst({
      where: eq(schema.teams.id, teamId),
      with: { members: { with: { user: true } } },
    });
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    // biome-ignore lint/suspicious/noExplicitAny: relation row shape matches resolveInternalHosts
    const hosts = resolveInternalHosts(team.members as any, session.user.id, d.memberIds);
    if (!hosts) return NextResponse.json({ error: "Not a team member" }, { status: 403 });
    const end = new Date(start.getTime() + d.durationMinutes * 60_000);
    const conflicts = await internalTeamBookingConflicts(hosts, start, end);
    return NextResponse.json({ conflicts, hostCount: hosts.length });
  }

  const result = await createInternalTeamBooking({
    teamId,
    organizerId: session.user.id,
    title: d.title,
    start,
    durationMinutes: d.durationMinutes,
    memberIds: d.memberIds,
    guests: d.guests,
    notes: d.notes,
    timezone,
  });
  if (!result) return NextResponse.json({ error: "Couldn't create the meeting" }, { status: 502 });
  return NextResponse.json(result);
}
