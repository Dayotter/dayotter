import { verifyState } from "@/lib/calendar/oauth-state";
import { env } from "@/lib/server/env";
import { logger } from "@dayotter/core";
import { connectCrm, exchangeCrmCode, isCrmProvider } from "@dayotter/integrations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** CRM OAuth callback: verify state, exchange the code, store the connection. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const settings = `${env.APP_URL}/settings/crm`;

  if (!isCrmProvider(provider)) return NextResponse.redirect(`${settings}?crm=error`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(`${settings}?crm=error`);

  const payload = verifyState(state);
  if (!payload || payload.provider !== provider) {
    return NextResponse.redirect(`${settings}?crm=error`);
  }

  try {
    const { credentials, account } = await exchangeCrmCode(provider, code);
    await connectCrm(payload.userId, provider, credentials, account);
    return NextResponse.redirect(`${settings}?crm=connected`);
  } catch (err) {
    logger.error("crm connect failed", { event: "crm_connect_failed", provider, err });
    return NextResponse.redirect(`${settings}?crm=error`);
  }
}
