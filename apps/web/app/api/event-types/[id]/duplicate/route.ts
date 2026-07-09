import { getSession } from "@/lib/auth/session";
import { and, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Build a slug that isn't already taken by this owner ("intro" → "intro-copy" → "intro-copy-2"). */
function uniqueSlug(base: string, taken: Set<string>) {
  let candidate = `${base}-copy`.slice(0, 60);
  if (!taken.has(candidate)) return candidate;
  for (let i = 2; i < 1000; i++) {
    candidate = `${base}-copy-${i}`.slice(0, 60);
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-copy-${Date.now()}`.slice(0, 60);
}

/** Duplicate one of the current user's event types into a new inactive-slug copy. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const userId = session.user.id;
  const db = getDb();

  const source = await db.query.eventTypes.findFirst({
    where: and(eq(schema.eventTypes.id, id), eq(schema.eventTypes.ownerId, userId)),
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const owned = await db.query.eventTypes.findMany({
    where: eq(schema.eventTypes.ownerId, userId),
    columns: { slug: true },
  });
  const slug = uniqueSlug(source.slug, new Set(owned.map((e) => e.slug)));

  const [created] = await db
    .insert(schema.eventTypes)
    .values({
      organizationId: source.organizationId,
      ownerId: userId,
      scheduleId: source.scheduleId,
      title: `${source.title} (copy)`.slice(0, 120),
      slug,
      description: source.description,
      durationMinutes: source.durationMinutes,
      location: source.location,
      locationDetail: source.locationDetail,
      bufferBeforeMinutes: source.bufferBeforeMinutes,
      bufferAfterMinutes: source.bufferAfterMinutes,
      minimumNoticeMinutes: source.minimumNoticeMinutes,
      slotIntervalMinutes: source.slotIntervalMinutes,
      minimumGapMinutes: source.minimumGapMinutes,
      durationOptions: source.durationOptions,
      bookingWindowDays: source.bookingWindowDays,
      dailyBookingLimit: source.dailyBookingLimit,
      isPrivate: source.isPrivate,
      redirectUrl: source.redirectUrl,
      color: source.color,
      price: source.price,
      currency: source.currency,
      depositAmount: source.depositAmount,
      questions: source.questions,
    })
    .returning();

  return NextResponse.json({ id: created!.id });
}
