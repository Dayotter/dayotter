import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

async function membershipOf(teamId: string, userId: string) {
  return getDb().query.teamMembers.findFirst({
    where: and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)),
  });
}

const body = z.object({
  enabled: z.boolean(),
  hour: z.number().int().min(0).max(23).optional(),
  recipients: z.enum(["admins", "all"]).optional(),
});

/** Update a team's daily-digest settings (owner/admin only). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: teamId } = await params;

  const membership = await membershipOf(teamId, session.user.id);
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json({ error: "Only team admins can change this" }, { status: 403 });
  }

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid settings" },
      { status: 400 },
    );
  }
  const { enabled, hour, recipients } = parsed.data;

  await getDb()
    .insert(schema.teamPreferences)
    .values({
      teamId,
      briefingEnabled: enabled,
      ...(hour !== undefined ? { briefingHour: hour } : {}),
      ...(recipients ? { briefingRecipients: recipients } : {}),
    })
    .onConflictDoUpdate({
      target: schema.teamPreferences.teamId,
      set: {
        briefingEnabled: enabled,
        ...(hour !== undefined ? { briefingHour: hour } : {}),
        ...(recipients ? { briefingRecipients: recipients } : {}),
      },
    });

  return NextResponse.json({ ok: true });
}
