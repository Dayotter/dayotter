import { isValidDelegate, listOutOfOffice, listTeammates } from "@/lib/out-of-office";
import { jsonError, withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The user's out-of-office periods plus the teammates they can delegate to. */
export const GET = withUser(async (u) => {
  const [periods, teammates] = await Promise.all([listOutOfOffice(u.id), listTeammates(u.id)]);
  return NextResponse.json({ periods, teammates });
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date");

const body = z.object({
  startDate: isoDate,
  endDate: isoDate,
  reason: z.string().trim().max(200).optional(),
  /** Teammate to redirect new bookings to while away. Must share a team. */
  delegateUserId: z.string().uuid().nullish(),
});

/** Create an out-of-office period. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid out-of-office period", 400);
  }
  const d = parsed.data;
  if (d.endDate < d.startDate) return jsonError("End date must be on or after start date", 400);

  // Cap how many periods one user can hold, so a runaway client can't fill the
  // table (each row is scanned on every availability computation for that user).
  const existing = await getDb().query.outOfOfficePeriods.findMany({
    where: eq(schema.outOfOfficePeriods.userId, u.id),
    columns: { id: true },
    limit: 200,
  });
  if (existing.length >= 100) {
    return jsonError("You've reached the maximum number of out-of-office periods (100)", 400);
  }

  // A delegate must be a real teammate - never let an arbitrary user id through.
  if (d.delegateUserId && !(await isValidDelegate(u.id, d.delegateUserId))) {
    return jsonError("Delegate must be one of your teammates", 400);
  }

  const [created] = await getDb()
    .insert(schema.outOfOfficePeriods)
    .values({
      userId: u.id,
      startDate: d.startDate,
      endDate: d.endDate,
      reason: d.reason?.length ? d.reason : null,
      delegateUserId: d.delegateUserId ?? null,
    })
    .returning({ id: schema.outOfOfficePeriods.id });

  return NextResponse.json({ id: created!.id }, { status: 201 });
});
