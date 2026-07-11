import { getSession } from "@/lib/auth/session";
import { and, asc, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The caller's membership row for a team, or null. */
async function membershipOf(teamId: string, userId: string) {
  return getDb().query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)),
  });
}

/** List a team's scheduling rules (any member may view). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;
  if (!(await membershipOf(teamId, session.user.id))) {
    return NextResponse.json({ error: "Not a team member" }, { status: 403 });
  }

  const rules = await getDb().query.teamRules.findMany({
    where: eq(schema.teamRules.teamId, teamId),
    orderBy: [asc(schema.teamRules.kind), asc(schema.teamRules.theDate)],
  });
  return NextResponse.json({ rules });
}

const body = z
  .object({
    kind: z.enum(["holiday", "no_meeting"]),
    label: z.string().trim().max(100).optional(),
    theDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date")
      .optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startMinute: z.number().int().min(0).max(1439).optional(),
    endMinute: z.number().int().min(1).max(1440).optional(),
  })
  .refine((d) => d.kind !== "holiday" || Boolean(d.theDate), {
    message: "Pick a date for the holiday",
    path: ["theDate"],
  })
  .refine(
    (d) =>
      d.kind !== "no_meeting" ||
      (d.startMinute != null && d.endMinute != null && d.endMinute > d.startMinute),
    { message: "Set a start and a later end time", path: ["endMinute"] },
  );

/** Add a rule (owner/admin only). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;

  const membership = await membershipOf(teamId, session.user.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Only team admins can change rules" }, { status: 403 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid rule" },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [created] = await getDb()
    .insert(schema.teamRules)
    .values({
      teamId,
      kind: d.kind,
      label: d.label || null,
      theDate: d.kind === "holiday" ? (d.theDate ?? null) : null,
      dayOfWeek: d.kind === "no_meeting" ? (d.dayOfWeek ?? null) : null,
      startMinute: d.kind === "no_meeting" ? (d.startMinute ?? null) : null,
      endMinute: d.kind === "no_meeting" ? (d.endMinute ?? null) : null,
    })
    .returning();

  return NextResponse.json({ rule: created });
}
