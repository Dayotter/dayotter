import { inboxData } from "@/lib/calendar/inbox";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Calendar Inbox: connections needing re-auth + double-booked meetings. */
export const GET = withUser(async (u) => {
  const inbox = await inboxData(u.id);
  return NextResponse.json({ inbox });
});
