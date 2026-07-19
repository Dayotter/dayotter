import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, inArray, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Team detail for a member: the team plus its member roster (name, email, role,
 * round-robin weight) and the caller's own role. The web team page reads this
 * server-side from the DB; the mobile team screen calls this endpoint.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const db = getDb();

  const caller = await db.query.teamMembers.findFirst({
    where: and(
      eq(schema.teamMembers.teamId, teamId),
      eq(schema.teamMembers.userId, session.user.id),
    ),
  });
  if (!caller) return NextResponse.json({ error: "Not a team member" }, { status: 403 });

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    columns: { id: true, name: true, slug: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

  const rows = await db.query.teamMembers.findMany({
    where: eq(schema.teamMembers.teamId, teamId),
  });
  const userIds = rows.map((r) => r.userId);
  const users = userIds.length
    ? await db.query.users.findMany({
        where: inArray(schema.users.id, userIds),
        columns: { id: true, name: true, email: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  const members = rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      name: byId.get(r.userId)?.name ?? null,
      email: byId.get(r.userId)?.email ?? "",
      role: r.role,
      priority: r.priority,
    }))
    // Owners first, then admins, then members; stable by email within a role.
    .sort((a, b) => {
      const rank = { owner: 0, admin: 1, member: 2 } as const;
      return rank[a.role] - rank[b.role] || a.email.localeCompare(b.email);
    });

  return NextResponse.json({ team, viewerRole: caller.role, members });
}
