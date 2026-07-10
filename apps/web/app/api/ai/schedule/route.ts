import { aiEnabled, parseScheduleRequest } from "@/lib/ai/schedule-parse";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ text: z.string().min(1).max(500) });

/** Turn a natural-language request into an editable scheduling draft. Never writes. */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);

  // LLM calls cost money — throttle per user.
  const limited = await enforceRateLimit(request, {
    name: "ai-schedule",
    limit: 20,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a request", 400);

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });

  try {
    const draft = await parseScheduleRequest({
      text: parsed.data.text,
      timezone: user?.timezone ?? "UTC",
      now: new Date(),
    });
    return NextResponse.json({ draft });
  } catch (err) {
    logger.error("ai schedule parse failed", { event: "ai_parse_failed", userId: u.id, err });
    return jsonError("Couldn't understand that. Try rephrasing, or add the details manually.", 502);
  }
});
