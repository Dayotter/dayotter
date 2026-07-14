import { aiEnabled } from "@/lib/ai/command-parse";
import { interpretOtterCommand } from "@/lib/ai/interpret";
import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logger } from "@dayotter/core";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({ text: z.string().min(1).max(500) });

/**
 * Natural-language command → an editable draft (create / reschedule / cancel).
 * Confirm-first: this only interprets against the user's own upcoming bookings;
 * it never writes. The client confirms, then calls the write endpoints. Shares
 * the Otter interpret core (lib/ai/interpret) with the mobile bar and SMS.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);
  const gate = await requireFeature(u.id, "ai");
  if (gate) return gate;

  const limited = await enforceRateLimit(request, {
    name: "ai-command",
    limit: 20,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Enter a request", 400);

  try {
    const { draft, target, matchedEventType } = await interpretOtterCommand(u.id, parsed.data.text);

    // Manage intent that couldn't be resolved to a real booking → tell the user.
    if ((draft.intent === "reschedule" || draft.intent === "cancel") && !target) {
      return NextResponse.json({
        draft: {
          ...draft,
          understood: false,
          message:
            draft.message || "I couldn't tell which meeting you meant. Try naming it or its time.",
        },
        target: null,
      });
    }

    return NextResponse.json({ draft, target, matchedEventType });
  } catch (err) {
    logger.error("ai command parse failed", { event: "ai_command_failed", userId: u.id, err });
    return jsonError("Couldn't understand that. Try rephrasing, or manage it manually.", 502);
  }
});
