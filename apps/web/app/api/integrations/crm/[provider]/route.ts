import { randomUUID } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { requireFeature } from "@/lib/billing/require-feature";
import { createState } from "@/lib/calendar/oauth-state";
import { and, eq, getDb, schema } from "@dayotter/db";
import { crmAuthUrl, crmEnabledProviders, isCrmProvider } from "@dayotter/integrations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Start the CRM OAuth flow: redirect the host to the provider's consent screen. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const settings = new URL("/settings/crm", request.url);

  if (!isCrmProvider(provider)) return NextResponse.json({ error: "Unsupported" }, { status: 400 });

  const session = await getSession();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/sign-in", request.url));

  const gate = await requireFeature(session.user.id, "crm_sync");
  if (gate) {
    settings.searchParams.set("crm", "upgrade");
    return NextResponse.redirect(settings);
  }

  if (!crmEnabledProviders().includes(provider)) {
    settings.searchParams.set("crm", "unavailable");
    return NextResponse.redirect(settings);
  }

  const state = createState({ userId: session.user.id, provider }, randomUUID());
  return NextResponse.redirect(crmAuthUrl(provider, state));
}

/** Disconnect a CRM. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  if (!isCrmProvider(provider)) return NextResponse.json({ error: "Unsupported" }, { status: 400 });

  const session = await getSession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await getDb()
    .delete(schema.crmConnections)
    .where(
      and(
        eq(schema.crmConnections.userId, session.user.id),
        eq(schema.crmConnections.provider, provider),
      ),
    )
    .returning({ id: schema.crmConnections.id });

  if (deleted.length === 0) return NextResponse.json({ error: "Not connected" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
