import { getSession } from "@/lib/auth/session";
import { randomToken } from "@dayotter/core";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Owner/admin of the team, or null if the caller can't manage it. */
async function requireManager(teamId: string) {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const member = await getDb().query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
    columns: { role: true },
  });
  if (!member || (member.role !== "owner" && member.role !== "admin")) return null;
  return session.user.id;
}

/**
 * Turn on (or rotate) the team's public availability calendar link. Returns a
 * fresh capability token; calling it again rotates the token, which immediately
 * revokes any previously shared link. Owner/admin only.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  if (!(await requireManager(teamId))) {
    return NextResponse.json({ error: "Only team admins can share the calendar" }, { status: 403 });
  }
  const token = randomToken(18);
  await getDb()
    .update(schema.teams)
    .set({ publicScheduleToken: token })
    .where(eq(schema.teams.id, teamId));
  return NextResponse.json({ token });
}

/** Turn off the public availability calendar (revokes the shared link). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: teamId } = await params;
  if (!(await requireManager(teamId))) {
    return NextResponse.json({ error: "Only team admins can share the calendar" }, { status: 403 });
  }
  await getDb()
    .update(schema.teams)
    .set({ publicScheduleToken: null })
    .where(eq(schema.teams.id, teamId));
  return NextResponse.json({ ok: true });
}
