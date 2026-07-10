import { verifyState } from "@/lib/calendar/oauth-state";
import { connectZoom, exchangeZoomCode, zoomEnabled } from "@/lib/integrations/zoom";
import { env } from "@/lib/server/env";
import { logger } from "@calsync/core";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Zoom OAuth callback: verify state, exchange the code, store the connection. */
export async function GET(request: Request) {
  const settings = `${env.APP_URL}/settings/calendars`;
  if (!zoomEnabled) return NextResponse.redirect(`${settings}?zoom=unavailable`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(`${settings}?zoom=error`);

  const payload = verifyState(state);
  if (!payload || payload.provider !== "zoom") {
    return NextResponse.redirect(`${settings}?zoom=error`);
  }

  try {
    const { credentials, account } = await exchangeZoomCode(code);
    await connectZoom(payload.userId, credentials, account);
    return NextResponse.redirect(`${settings}?zoom=connected`);
  } catch (err) {
    logger.error("zoom connect failed", { event: "zoom_connect_failed", err });
    return NextResponse.redirect(`${settings}?zoom=error`);
  }
}
