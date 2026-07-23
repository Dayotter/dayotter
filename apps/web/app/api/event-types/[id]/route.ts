import { getSession } from "@/lib/auth/session";
import { eventTypeInputSchema } from "@/lib/booking/event-type-input";
import { resolveScheduleId } from "@/lib/booking/schedule";
import { sha256hex } from "@dayotter/core";
import { and, eq, getDb, schema, sql } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Return the event type only if `userId` may manage it: the personal owner, or
 * - for a team-owned event type (`ownerId` null, `teamId` set) - an owner/admin
 * of that team. Returns null otherwise (treated as 404 to avoid leaking ids).
 */
async function manageableEventType(id: string, userId: string) {
  const db = getDb();
  const et = await db.query.eventTypes.findFirst({ where: eq(schema.eventTypes.id, id) });
  if (!et) return null;
  if (et.ownerId === userId) return et;
  if (et.teamId) {
    const membership = await db.query.teamMembers.findFirst({
      where: and(eq(schema.teamMembers.teamId, et.teamId), eq(schema.teamMembers.userId, userId)),
    });
    if (membership && (membership.role === "owner" || membership.role === "admin")) return et;
  }
  return null;
}

/** Full event type for the manage/edit views (web edit page + mobile form). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const et = await manageableEventType(id, session.user.id);
  if (!et) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    eventType: {
      id: et.id,
      title: et.title,
      slug: et.slug,
      durationMinutes: et.durationMinutes,
      description: et.description,
      location: et.location,
      locationDetail: et.locationDetail,
      bufferBeforeMinutes: et.bufferBeforeMinutes,
      bufferAfterMinutes: et.bufferAfterMinutes,
      minimumNoticeMinutes: et.minimumNoticeMinutes,
      slotIntervalMinutes: et.slotIntervalMinutes,
      minimumGapMinutes: et.minimumGapMinutes,
      durationOptions: et.durationOptions,
      bookingWindowDays: et.bookingWindowDays,
      dailyBookingLimit: et.dailyBookingLimit,
      weeklyBookingLimit: et.weeklyBookingLimit,
      maxAttendees: et.maxAttendees,
      // Never leak the hash - only whether a code is required.
      hasAccessCode: et.accessCodeHash != null,
      isPrivate: et.isPrivate,
      requiresConfirmation: et.requiresConfirmation,
      redirectUrl: et.redirectUrl,
      color: et.color,
      price: et.price,
      currency: et.currency,
      depositAmount: et.depositAmount,
      questions: et.questions,
      scheduleId: et.scheduleId,
      isActive: et.isActive,
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await manageableEventType(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = eventTypeInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // Validate the chosen schedule belongs to this user (else fall back to default).
  const scheduleId = await resolveScheduleId(session.user.id, d.scheduleId);

  try {
    await getDb()
      .update(schema.eventTypes)
      .set({
        scheduleId,
        title: d.title,
        slug: d.slug,
        durationMinutes: d.durationMinutes,
        description: d.description ?? null,
        location: d.location,
        locationDetail: d.locationDetail ?? null,
        bufferBeforeMinutes: d.bufferBeforeMinutes,
        bufferAfterMinutes: d.bufferAfterMinutes,
        minimumNoticeMinutes: d.minimumNoticeMinutes,
        slotIntervalMinutes: d.slotIntervalMinutes,
        minimumGapMinutes: d.minimumGapMinutes,
        durationOptions: d.durationOptions,
        bookingWindowDays: d.bookingWindowDays,
        dailyBookingLimit: d.dailyBookingLimit,
        weeklyBookingLimit: d.weeklyBookingLimit,
        maxAttendees: d.maxAttendees,
        recurringCount: d.recurringCount,
        recurringFrequency: d.recurringFrequency,
        isPrivate: d.isPrivate,
        requiresConfirmation: d.requiresConfirmation,
        redirectUrl: d.redirectUrl,
        color: d.color,
        price: d.price,
        currency: d.currency,
        depositAmount: d.depositAmount,
        questions: d.questions,
        // Access code: undefined = unchanged, null = remove, string = set.
        ...(d.accessCode === undefined
          ? {}
          : { accessCodeHash: d.accessCode ? sha256hex(d.accessCode) : null }),
      })
      .where(eq(schema.eventTypes.id, id));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "That slug may already be in use." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const existing = await manageableEventType(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.bookings)
    .where(eq(schema.bookings.eventTypeId, id));

  if (count > 0) {
    // Preserve booking history; hide it from booking pages instead of deleting.
    await db.update(schema.eventTypes).set({ isActive: false }).where(eq(schema.eventTypes.id, id));
    return NextResponse.json({ ok: true, archived: true });
  }

  await db.delete(schema.eventTypes).where(eq(schema.eventTypes.id, id));
  return NextResponse.json({ ok: true });
}
