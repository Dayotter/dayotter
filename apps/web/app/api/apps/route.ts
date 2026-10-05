import { APPS, CATEGORY_LABELS } from "@/lib/apps/registry";
import { resolveAppStatuses } from "@/lib/apps/status";
import { withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * The app/integrations catalog with this user's per-app status, so the mobile
 * app store can render straight from the registry (the web settings/apps page
 * reads the registry + resolveAppStatuses server-side; this is the JSON view).
 * Connecting is OAuth/env-based and happens on the web, so clients open `href`
 * there - no secrets or env values are returned, only app metadata + status.
 */
export const GET = withUser(async (u) => {
  const statuses = await resolveAppStatuses(u.id);
  const apps = APPS.map((a) => ({
    id: a.id,
    name: a.name,
    category: a.category,
    categoryLabel: CATEGORY_LABELS[a.category],
    blurb: a.blurb,
    color: a.color,
    href: a.href,
    external: Boolean(a.external),
    builtIn: Boolean(a.builtIn),
    needsConnection: Boolean(a.connection),
    configured: statuses[a.id]?.configured ?? true,
    connected: statuses[a.id]?.connected ?? false,
  }));
  return NextResponse.json({ apps });
});
