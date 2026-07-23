import { CalendlyAuthError, fetchCalendlyExport } from "@/lib/import/calendly-client";
import { importCalendlyExport } from "@/lib/import/run-import";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ token: z.string().min(10).max(500) });

/**
 * Import a user's Calendly event types + availability from a Personal Access
 * Token. The token is used only for this request and never stored. Host-only.
 */
export const POST = withUser(async (u, request) => {
  // The import creates rows and calls an external API - throttle per user.
  const limited = await enforceRateLimit(request, {
    name: "calendly-import",
    limit: 5,
    windowSec: 600,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Paste your Calendly access token to import.", 400);

  try {
    const data = await fetchCalendlyExport(parsed.data.token.trim());
    const summary = await importCalendlyExport(u.id, data);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof CalendlyAuthError) {
      return jsonError(
        "Calendly rejected that token. Check it's a valid access token and retry.",
        400,
      );
    }
    logger.error("calendly import failed", { event: "calendly_import_failed", userId: u.id, err });
    return jsonError("Couldn't import from Calendly right now. Please try again.", 502);
  }
});
