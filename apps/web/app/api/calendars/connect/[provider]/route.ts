import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { createState } from "@/lib/calendar/oauth-state";
import { providerConfig } from "@/lib/calendar/providers";
import { GoogleCalendarAdapter, MicrosoftCalendarAdapter } from "@dayotter/calendar";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start the calendar-connection OAuth flow: redirect the user to consent. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (provider !== "google" && provider !== "microsoft") {
    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  }

  const session = await getSession();
  if (!session?.user?.id) {
    const signIn = new URL("/sign-in", request.url);
    return NextResponse.redirect(signIn);
  }

  const state = createState({ userId: session.user.id, provider }, randomUUID());
  const config = providerConfig(provider);
  const authUrl =
    provider === "google"
      ? GoogleCalendarAdapter.authUrl(config, state)
      : MicrosoftCalendarAdapter.authUrl(config, state);

  return NextResponse.redirect(authUrl);
}
