import { getSession } from "@/lib/auth/session";
import { slugify, uniqueSlug } from "@/lib/slug";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  title: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  durationMinutes: z.number().int().min(5).max(480),
  schedulingType: z.enum(["collective", "round_robin"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  const db = getDb();

  const team = await db.query.teams.findFirst({
    where: eq(schema.teams.id, teamId),
    with: { members: true },
  });
  if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
  const caller = team.members.find((m) => m.userId === session.user.id);
  if (!caller) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }
  if (caller.role !== "owner" && caller.role !== "admin") {
    return NextResponse.json(
      { error: "Only team admins can create team event types" },
      { status: 403 },
    );
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const base = parsed.data.slug ?? slugify(parsed.data.title);
  const slug = await uniqueSlug(base, async (v) =>
    Boolean(
      await db.query.eventTypes.findFirst({
        where: and(eq(schema.eventTypes.teamId, teamId), eq(schema.eventTypes.slug, v)),
      }),
    ),
  );

  const [eventType] = await db
    .insert(schema.eventTypes)
    .values({
      organizationId: team.organizationId,
      ownerId: null,
      teamId,
      title: parsed.data.title,
      slug,
      durationMinutes: parsed.data.durationMinutes,
      schedulingType: parsed.data.schedulingType,
    })
    .returning();
  if (!eventType) return NextResponse.json({ error: "Could not create" }, { status: 500 });

  // Every current member is a host.
  if (team.members.length) {
    await db.insert(schema.eventTypeHosts).values(
      team.members.map((m) => ({
        eventTypeId: eventType.id,
        userId: m.userId,
        priority: m.priority,
      })),
    );
  }

  return NextResponse.json({ id: eventType.id, url: `/team/${team.slug}/${slug}` });
}
