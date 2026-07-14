import { jsonError, withUser } from "@/lib/server/http";
import { and, eq, getDb, inArray, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** The host's event types (packages are always scoped to one). */
async function ownedEventTypeIds(userId: string): Promise<string[]> {
  const rows = await getDb().query.eventTypes.findMany({
    where: eq(schema.eventTypes.ownerId, userId),
    columns: { id: true },
  });
  return rows.map((r) => r.id);
}

/** List the host's package offerings + outstanding client balances. */
export const GET = withUser(async (u) => {
  const db = getDb();
  const etIds = await ownedEventTypeIds(u.id);
  if (etIds.length === 0) return NextResponse.json({ packages: [], credits: [] });

  const [packages, credits] = await Promise.all([
    db.query.sessionPackages.findMany({
      where: inArray(schema.sessionPackages.eventTypeId, etIds),
      orderBy: (p, { desc }) => desc(p.createdAt),
    }),
    db.query.packageCredits.findMany({
      where: inArray(schema.packageCredits.eventTypeId, etIds),
      orderBy: (c, { desc }) => desc(c.createdAt),
    }),
  ]);

  return NextResponse.json({
    packages,
    credits: credits.map((c) => ({
      id: c.id,
      eventTypeId: c.eventTypeId,
      clientEmail: c.clientEmail,
      total: c.totalCredits,
      used: c.usedCredits,
      remaining: c.totalCredits - c.usedCredits,
    })),
  });
});

const createSchema = z.object({
  eventTypeId: z.string().uuid(),
  name: z.string().min(1).max(120),
  sessionCount: z.number().int().min(1).max(100),
  priceAmount: z.number().int().min(0).max(10_000_00),
  currency: z.string().length(3).default("usd"),
});

/** Create a package offering for one of the host's event types. */
export const POST = withUser(async (u, request) => {
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the package details", 400);
  const d = parsed.data;

  const eventType = await getDb().query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, d.eventTypeId), eq(schema.eventTypes.ownerId, u.id)),
    columns: { id: true, organizationId: true },
  });
  if (!eventType) return jsonError("Event type not found", 404);

  const [pkg] = await getDb()
    .insert(schema.sessionPackages)
    .values({
      organizationId: eventType.organizationId,
      eventTypeId: eventType.id,
      name: d.name,
      sessionCount: d.sessionCount,
      priceAmount: d.priceAmount,
      currency: d.currency.toLowerCase(),
    })
    .returning();

  return NextResponse.json({ package: pkg }, { status: 201 });
});
