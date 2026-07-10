import { randomUUID } from "node:crypto";
import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, schema } from "@calsync/db";
import { DateTime } from "luxon";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The user's upcoming personal / focus blocks. */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.timeBlocks.findMany({
    where: and(eq(schema.timeBlocks.userId, u.id), gte(schema.timeBlocks.endsAt, new Date())),
    orderBy: asc(schema.timeBlocks.startsAt),
    limit: 100,
  });
  return NextResponse.json({
    blocks: rows.map((b) => ({
      id: b.id,
      title: b.title,
      kind: b.kind,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      seriesId: b.seriesId,
    })),
  });
});

const body = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["focus", "personal", "travel", "other"]).default("focus"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  /** Repeat weekly for this many additional weeks (0 = one-off, max 25). */
  repeatWeeks: z.number().int().min(0).max(25).default(0),
  /** Booker/creator timezone so weekly occurrences keep the same local time (DST-safe). */
  timezone: z.string().min(1).default("UTC"),
});

/** Create a personal / focus block (optionally recurring weekly) that blocks the
 *  user's bookable availability. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid block", 400);
  const d = parsed.data;
  const start = new Date(d.startsAt);
  const end = new Date(d.endsAt);
  if (end <= start) return jsonError("End must be after start", 400);

  // Build occurrences. For a recurring block, advance by whole weeks in the
  // creator's timezone so the local time stays fixed across DST transitions.
  const seriesId = d.repeatWeeks > 0 ? randomUUID() : null;
  const startDt = DateTime.fromJSDate(start).setZone(d.timezone);
  const endDt = DateTime.fromJSDate(end).setZone(d.timezone);
  const values = [];
  for (let w = 0; w <= d.repeatWeeks; w++) {
    values.push({
      userId: u.id,
      title: d.title,
      kind: d.kind,
      startsAt: startDt.plus({ weeks: w }).toJSDate(),
      endsAt: endDt.plus({ weeks: w }).toJSDate(),
      seriesId,
    });
  }

  const created = await getDb().insert(schema.timeBlocks).values(values).returning();
  const first = created[0];
  return NextResponse.json({
    block: {
      id: first!.id,
      title: first!.title,
      kind: first!.kind,
      startsAt: first!.startsAt.toISOString(),
      endsAt: first!.endsAt.toISOString(),
      seriesId: first!.seriesId,
    },
    count: created.length,
  });
});
