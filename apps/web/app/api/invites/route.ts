import { listPendingInvites } from "@/lib/calendar/invites";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Pending calendar invitations across the user's connected calendars. */
export const GET = withUser(async (u) => {
  const invites = await listPendingInvites(u.id);
  return NextResponse.json({
    invites: invites.map((i) => ({
      connectionId: i.connectionId,
      calendarExternalId: i.calendarExternalId,
      externalEventId: i.externalEventId,
      title: i.title,
      startISO: i.start.toISOString(),
      endISO: i.end.toISOString(),
      organizerName: i.organizer?.name ?? i.organizer?.email ?? null,
      hasConflict: i.hasConflict,
    })),
  });
});
