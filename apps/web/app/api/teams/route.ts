import { getSession } from "@/lib/auth/session";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { slugify, uniqueSlug } from "@/lib/slug";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** List the teams the current user belongs to. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberships = await getDb().query.teamMembers.findMany({
    where: eq(schema.teamMembers.userId, session.user.id),
    with: { team: { with: { members: true } } },
  });
  return NextResponse.json({
    teams: memberships.map((m) => ({
      id: m.team.id,
      name: m.team.name,
      slug: m.team.slug,
      memberCount: m.team.members.length,
    })),
  });
}

const schemaBody = z.object({ name: z.string().min(1).max(80) });

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = schemaBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });

  const { organizationId } = await ensureUserWorkspace(session.user.id);
  const db = getDb();

  const slug = await uniqueSlug(slugify(parsed.data.name), async (v) =>
    Boolean(
      await db.query.teams.findFirst({
        where: and(eq(schema.teams.organizationId, organizationId), eq(schema.teams.slug, v)),
      }),
    ),
  );

  const [team] = await db
    .insert(schema.teams)
    .values({ organizationId, name: parsed.data.name, slug })
    .returning();
  if (!team) return NextResponse.json({ error: "Could not create team" }, { status: 500 });

  // Creator is the first member and the team owner.
  await db
    .insert(schema.teamMembers)
    .values({ teamId: team.id, userId: session.user.id, role: "owner", priority: 1 })
    .onConflictDoNothing();

  return NextResponse.json({ id: team.id, slug: team.slug });
}
