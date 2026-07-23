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
      offsetStartMinutes: et.offsetStartMinutes,
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

  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const parsed = eventTypeInputSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;

  // PUT here behaves as a partial update: a field the caller OMITS must keep its
  // stored value, not silently reset to the zod default. Otherwise a client that
  // sends a subset of fields (e.g. the mobile editor, which doesn't yet expose
  // every control) would wipe offsetStartMinutes, requiresConfirmation,
  // maxAttendees, recurring settings, etc. `keep` picks the parsed value only
  // when the key was actually present in the request body.
  const has = (k: string) => raw != null && Object.hasOwn(raw, k);
  // Use the parsed value only when the caller actually sent the key; otherwise
  // keep what's stored.
  const pick = <T>(k: string, next: T, prev: T): T => (has(k) ? next : prev);

  // Validate a newly-chosen schedule belongs to this user; keep the current one
  // when the caller didn't send one.
  const scheduleId = has("scheduleId")
    ? await resolveScheduleId(session.user.id, d.scheduleId)
    : existing.scheduleId;

  try {
    await getDb()
      .update(schema.eventTypes)
      .set({
        scheduleId,
        title: d.title,
        slug: d.slug,
        durationMinutes: d.durationMinutes,
        description: pick("description", d.description ?? null, existing.description),
        location: d.location,
        locationDetail: pick("locationDetail", d.locationDetail ?? null, existing.locationDetail),
        bufferBeforeMinutes: pick(
          "bufferBeforeMinutes",
          d.bufferBeforeMinutes,
          existing.bufferBeforeMinutes,
        ),
        bufferAfterMinutes: pick(
          "bufferAfterMinutes",
          d.bufferAfterMinutes,
          existing.bufferAfterMinutes,
        ),
        minimumNoticeMinutes: pick(
          "minimumNoticeMinutes",
          d.minimumNoticeMinutes,
          existing.minimumNoticeMinutes,
        ),
        slotIntervalMinutes: pick(
          "slotIntervalMinutes",
          d.slotIntervalMinutes,
          existing.slotIntervalMinutes,
        ),
        offsetStartMinutes: pick(
          "offsetStartMinutes",
          d.offsetStartMinutes,
          existing.offsetStartMinutes,
        ),
        minimumGapMinutes: pick(
          "minimumGapMinutes",
          d.minimumGapMinutes,
          existing.minimumGapMinutes,
        ),
        durationOptions: pick("durationOptions", d.durationOptions, existing.durationOptions),
        bookingWindowDays: pick(
          "bookingWindowDays",
          d.bookingWindowDays,
          existing.bookingWindowDays,
        ),
        dailyBookingLimit: pick(
          "dailyBookingLimit",
          d.dailyBookingLimit,
          existing.dailyBookingLimit,
        ),
        weeklyBookingLimit: pick(
          "weeklyBookingLimit",
          d.weeklyBookingLimit,
          existing.weeklyBookingLimit,
        ),
        maxAttendees: pick("maxAttendees", d.maxAttendees, existing.maxAttendees),
        recurringCount: pick("recurringCount", d.recurringCount, existing.recurringCount),
        recurringFrequency: pick(
          "recurringFrequency",
          d.recurringFrequency,
          existing.recurringFrequency,
        ),
        isPrivate: pick("isPrivate", d.isPrivate, existing.isPrivate),
        requiresConfirmation: pick(
          "requiresConfirmation",
          d.requiresConfirmation,
          existing.requiresConfirmation,
        ),
        redirectUrl: pick("redirectUrl", d.redirectUrl, existing.redirectUrl),
        color: pick("color", d.color, existing.color as typeof d.color),
        price: pick("price", d.price, existing.price),
        currency: pick("currency", d.currency, existing.currency as typeof d.currency),
        depositAmount: pick("depositAmount", d.depositAmount, existing.depositAmount),
        questions: pick("questions", d.questions, existing.questions),
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
