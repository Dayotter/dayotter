import { mapCalcomExport } from "@/lib/import/calcom";
import { CalcomAuthError, fetchCalcomEventTypes } from "@/lib/import/calcom-client";
import { importCalcomEventTypes } from "@/lib/import/run-import";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  apiKey: z.string().min(6).max(500),
  /** Optional self-hosted Cal.com base (e.g. https://cal.acme.com/api/v1). */
  baseUrl: z.string().url().max(300).optional(),
});

/**
 * Import a user's Cal.com event types from a v1 API key. The key is used only for
 * this request and never stored. Egress is SSRF-safe (pinned `safeFetch`) and the
 * key/base are validated. Host-only.
 */
export const POST = withUser(async (u, request) => {
  const limited = await enforceRateLimit(request, {
    name: "calcom-import",
    limit: 5,
    windowSec: 600,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Paste your Cal.com API key to import.", 400);

  try {
    const data = await fetchCalcomEventTypes(parsed.data.apiKey.trim(), parsed.data.baseUrl);
    const mapped = mapCalcomExport(data);
    const summary = await importCalcomEventTypes(u.id, mapped);
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof CalcomAuthError) {
      return jsonError("Cal.com rejected that API key. Check it and retry.", 400);
    }
    logger.error("cal.com import failed", { event: "calcom_import_failed", err });
    return jsonError(
      "Couldn't import from Cal.com. Check the API key (and base URL) and retry.",
      502,
    );
  }
});
