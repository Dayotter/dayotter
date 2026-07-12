import { aiEnabled } from "@/lib/ai/llm";
import { executeActionTool } from "@/lib/ai/tools/exec";
import { getTool } from "@/lib/ai/tools/registry";
import { requireFeature } from "@/lib/billing/require-feature";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  tool: z.string().min(1).max(64),
  input: z.record(z.unknown()).default({}),
});

/**
 * Execute a confirmed AI action. The chat only ever PROPOSES an action (shows a
 * confirm card); this endpoint runs it after the user taps Confirm — so nothing
 * the assistant suggests happens without an explicit click. Reads never come
 * here (they run inline in the chat stream); only write/destructive tools do,
 * and deletes are gated behind the danger confirm on the client.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI isn't enabled on this server.", 503);
  const gate = await requireFeature(u.id, "ai");
  if (gate) return gate;

  const limited = await enforceRateLimit(request, {
    name: "ai-act",
    limit: 30,
    windowSec: 300,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid action request.", 400);

  const tool = getTool(parsed.data.tool);
  if (!tool || tool.kind === "read") return jsonError("Unknown action.", 400);

  const result = await executeActionTool(u.id, parsed.data.tool, parsed.data.input);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
});
