import { getSession } from "@/lib/auth/session";
import { desc, eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** List the current user's bookings (as host). */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb().query.bookings.findMany({
    where: eq(schema.bookings.hostId, session.user.id),
    orderBy: desc(schema.bookings.startsAt),
    limit: 100,
    with: { attendees: true },
  });

  return NextResponse.json({
    bookings: rows.map((b) => ({
      uid: b.uid,
      title: b.title,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      timezone: b.timezone,
      status: b.status,
      meetingUrl: b.meetingUrl,
      attendees: b.attendees.map((a) => ({ name: a.name, email: a.email })),
    })),
  });
}
