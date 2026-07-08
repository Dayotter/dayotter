import { getSession } from "@/lib/auth/session";
import { eventTypeInputSchema } from "@/lib/booking/event-type-input";
import { ensureUserWorkspace } from "@/lib/bootstrap";
import { desc, eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** List the current user's event types (mobile + any client). */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb().query.eventTypes.findMany({
    where: eq(schema.eventTypes.ownerId, session.user.id),
    orderBy: desc(schema.eventTypes.createdAt),
  });
  const handle = (session.user as { handle?: string | null }).handle ?? null;
  return NextResponse.json({
    eventTypes: rows.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      durationMinutes: e.durationMinutes,
      description: e.description,
      isActive: e.isActive,
      location: e.location,
      color: e.color,
      url: handle ? `/${handle}/${e.slug}` : null,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = eventTypeInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  const { organizationId, scheduleId, handle } = await ensureUserWorkspace(session.user.id);

  try {
    const [created] = await getDb()
      .insert(schema.eventTypes)
      .values({
        organizationId,
        ownerId: session.user.id,
        scheduleId,
        title: d.title,
        slug: d.slug,
        durationMinutes: d.durationMinutes,
        description: d.description,
        location: d.location,
        locationDetail: d.locationDetail,
        bufferBeforeMinutes: d.bufferBeforeMinutes,
        bufferAfterMinutes: d.bufferAfterMinutes,
        minimumNoticeMinutes: d.minimumNoticeMinutes,
        bookingWindowDays: d.bookingWindowDays,
        dailyBookingLimit: d.dailyBookingLimit,
        isPrivate: d.isPrivate,
        redirectUrl: d.redirectUrl,
        color: d.color,
        questions: d.questions,
      })
      .returning();

    return NextResponse.json({
      id: created!.id,
      url: `/${handle}/${created!.slug}`,
    });
  } catch (err) {
    // Most likely a duplicate slug for this owner.
    return NextResponse.json(
      { error: "Could not create event type (slug may already be in use)." },
      { status: 409 },
    );
  }
}
