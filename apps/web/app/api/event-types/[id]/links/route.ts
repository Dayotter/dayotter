import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
});

/** Create a single-use (or limited/expiring) booking link for one of the user's event types. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const et = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, session.user.id)),
    columns: { id: true },
  });
  if (!et) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = body.safeParse(await request.json().catch(() => ({})));
  const { maxUses, expiresAt } = parsed.success ? parsed.data : { maxUses: 1, expiresAt: null };

  const token = randomUUID().replace(/-/g, "").slice(0, 20);
  await getDb().insert(schema.bookingLinks).values({
    ownerId: session.user.id,
    eventTypeId: id,
    token,
    maxUses,
    expiresAt,
  });

  return NextResponse.json({ token, url: `/book/${token}` });
}
