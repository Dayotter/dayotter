import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ priority: z.number().int().min(0).max(10) });

/**
 * Update a team member's round-robin weight. Higher = assigned more often; 0 =
 * paused from the rotation. Propagates to the member's host rows on the team's
 * existing round-robin event types so the change takes effect immediately.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, memberId } = await params;
  const db = getDb();

  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
    return NextResponse.json({ error: "Only team admins can change weights" }, { status: 403 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid weight" }, { status: 400 });

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)),
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  await db
    .update(schema.teamMembers)
    .set({ priority: parsed.data.priority })
    .where(eq(schema.teamMembers.id, memberId));

  // Reflect the new weight on this member's host rows for the team's event types.
  const teamEventTypes = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.teamId, teamId),
    columns: { id: true },
  });
  if (teamEventTypes.length > 0) {
    for (const et of teamEventTypes) {
      await db
        .update(schema.eventTypeHosts)
        .set({ priority: parsed.data.priority })
        .where(
          and(
            eq(schema.eventTypeHosts.eventTypeId, et.id),
            eq(schema.eventTypeHosts.userId, member.userId),
          ),
        );
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Remove a member from the team. Admins/owners can remove anyone; any member can
 * remove (leave) themselves. The owner can't leave or be removed - they must
 * transfer ownership or delete the team first.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId, memberId } = await params;
  const db = getDb();

  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller) {
    return NextResponse.json({ error: "You're not a member of this team" }, { status: 403 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.id, memberId), eq(schema.teamMembers.teamId, teamId)),
  });
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });

  // Admins/owners can remove anyone; a member may always remove themselves.
  const isSelf = member.userId === session.user.id;
  const isAdmin = caller.role === "owner" || caller.role === "admin";
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Only team admins can remove members" }, { status: 403 });
  }
  if (member.role === "owner") {
    return NextResponse.json(
      {
        error: "The team owner can't leave or be removed - transfer ownership or delete the team.",
      },
      { status: 400 },
    );
  }

  await db.delete(schema.teamMembers).where(eq(schema.teamMembers.id, memberId));
  // Drop the member from the team's round-robin event types too.
  const teamEventTypes = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.teamId, teamId),
    columns: { id: true },
  });
  for (const et of teamEventTypes) {
    await db
      .delete(schema.eventTypeHosts)
      .where(
        and(
          eq(schema.eventTypeHosts.eventTypeId, et.id),
          eq(schema.eventTypeHosts.userId, member.userId),
        ),
      );
  }

  return NextResponse.json({ ok: true });
}
