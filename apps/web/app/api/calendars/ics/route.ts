import { IcsFeedError, connectIcsFeed } from "@/lib/calendar/calendar-connect";
import { jsonError, withUser } from "@/lib/server/http";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Enter a calendar feed URL")
    .regex(/^(https?|webcal):\/\//i, "Enter an https or webcal feed URL"),
  name: z.string().trim().max(80).optional(),
});

/**
 * Subscribe to an external ICS / webcal feed as a read-only busy source. Direct
 * form post (no OAuth); the feed is validated synchronously so the user gets
 * immediate feedback.
 */
export const POST = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid details", 400);
  }

  try {
    const result = await connectIcsFeed({
      userId: u.id,
      url: parsed.data.url,
      name: parsed.data.name,
    });
    return NextResponse.json({ ok: true, calendarCount: result.calendarCount });
  } catch (err) {
    if (err instanceof IcsFeedError) return jsonError(err.message, 400);
    console.error("[calendars/ics] connect failed:", err);
    return jsonError("Could not connect. Please try again.", 500);
  }
});
