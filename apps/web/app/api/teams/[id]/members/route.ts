import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ email: z.string().email() });

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
  });
  if (!membership) return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only team admins can add members" }, { status: 403 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, parsed.data.email.toLowerCase()),
  });
  if (!user) {
    return NextResponse.json(
      { error: "No calSync account with that email yet. They need to sign up first." },
      { status: 404 },
    );
  }

  await db
    .insert(schema.teamMembers)
    .values({ teamId, userId: user.id, priority: 1 })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, name: user.name ?? user.email });
}
