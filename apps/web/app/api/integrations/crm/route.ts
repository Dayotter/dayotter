import { withUser } from "@/lib/server/http";
import { eq, getDb, schema } from "@dayotter/db";
import { crmEnabledProviders } from "@dayotter/integrations";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * CRM connection status for the signed-in user (the mobile CRM screen; the web
 * settings page reads the same data server-side). Returns the user's connected
 * providers and which providers are configured (env-gated) on this server.
 */
export const GET = withUser(async (u) => {
  const rows = await getDb().query.crmConnections.findMany({
    where: eq(schema.crmConnections.userId, u.id),
  });
  return NextResponse.json({
    connections: rows.map((c) => ({
      id: c.id,
      provider: c.provider,
      accountLabel: c.accountLabel,
      externalAccountId: c.externalAccountId,
      lastError: c.lastError,
    })),
    enabled: crmEnabledProviders(),
  });
});
