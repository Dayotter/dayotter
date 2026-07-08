import { aiEnabled } from "@/lib/ai/llm";
import { suggestInviteResponse } from "@/lib/ai/invite-triage";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@calsync/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  title: z.string().min(1).max(300),
  whenText: z.string().min(1).max(120),
  organizer: z.string().max(200).default("unknown"),
  hasConflict: z.boolean(),
});

/** Suggest how to respond to an invitation. Advisory only. */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI isn't enabled on this server.", 503);
  const limited = await enforceRateLimit(request, {
    name: "ai-invite",
    limit: 30,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request", 400);

  try {
    const triage = await suggestInviteResponse(parsed.data);
    return NextResponse.json({ triage });
  } catch (err) {
    logger.error("ai invite suggest failed", { event: "ai_invite_suggest_failed", userId: u.id, err });
    return jsonError("Couldn't get a suggestion right now.", 502);
  }
});
