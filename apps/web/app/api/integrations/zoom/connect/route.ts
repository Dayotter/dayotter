import { getSession } from "@/lib/auth/session";
import { createState } from "@/lib/calendar/oauth-state";
import { zoomAuthUrl, zoomEnabled } from "@/lib/integrations/zoom";
import { env } from "@/lib/server/env";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start the Zoom OAuth flow: redirect the host to Zoom's consent screen. */
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return NextResponse.redirect(`${env.APP_URL}/sign-in`);
  if (!zoomEnabled) {
    return NextResponse.redirect(`${env.APP_URL}/settings/calendars?zoom=unavailable`);
  }
  const state = createState({ userId: session.user.id, provider: "zoom" }, randomUUID());
  return NextResponse.redirect(zoomAuthUrl(state));
}
