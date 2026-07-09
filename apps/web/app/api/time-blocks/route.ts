import { jsonError, withUser } from "@/lib/server/http";
import { and, asc, eq, getDb, gte, schema } from "@calsync/db";
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
    })),
  });
});

const body = z.object({
  title: z.string().min(1).max(120),
  kind: z.enum(["focus", "personal", "travel", "other"]).default("focus"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

/** Create a personal / focus block that blocks the user's bookable availability. */
export const POST = withUser(async (u, request) => {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid block", 400);
  const d = parsed.data;
  const start = new Date(d.startsAt);
  const end = new Date(d.endsAt);
  if (end <= start) return jsonError("End must be after start", 400);

  const [created] = await getDb()
    .insert(schema.timeBlocks)
    .values({ userId: u.id, title: d.title, kind: d.kind, startsAt: start, endsAt: end })
    .returning();

  return NextResponse.json({
    block: {
      id: created!.id,
      title: created!.title,
      kind: created!.kind,
      startsAt: created!.startsAt.toISOString(),
      endsAt: created!.endsAt.toISOString(),
    },
  });
});
