import { getProactiveSuggestions } from "@/lib/ai/proactive";
import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Proactive suggestions to show the user right now. */
export const GET = withUser(async (u) => {
  const suggestions = await getProactiveSuggestions(u.id);
  return NextResponse.json({ suggestions });
});

const actSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("focus"),
    startISO: z.string().datetime(),
    durationMinutes: z.number().int().min(15).max(480),
    title: z.string().max(120).default("Deep work"),
  }),
  z.object({ type: z.literal("enable_overflow") }),
  z.object({ type: z.literal("enable_briefing") }),
]);

/** Act on a suggestion (confirm-first — always from an explicit user tap). */
export const POST = withUser(async (u, request) => {
  const parsed = actSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Unknown suggestion", 400);
  const d = parsed.data;
  const db = getDb();

  try {
    if (d.type === "focus") {
      const start = new Date(d.startISO);
      const end = new Date(start.getTime() + d.durationMinutes * 60_000);
      // Hold it as a real focus time_block (the availability engine treats these
      // as busy), then best-effort mirror it to the calendar.
      await db.insert(schema.timeBlocks).values({
        userId: u.id,
        title: d.title,
        kind: "focus",
        startsAt: start,
        endsAt: end,
        seriesId: null,
      });
      const user = await db.query.users.findFirst({
        where: eq(schema.users.id, u.id),
        columns: { timezone: true },
      });
      await writeBookingToCalendar(u.id, {
        title: d.title,
        start,
        end,
        timezone: user?.timezone ?? "UTC",
        attendees: [],
      }).catch(() => null);
      return NextResponse.json({ ok: true, message: "Focus time held." });
    }

    // Preference toggles — upsert so a user without a prefs row still works.
    const set =
      d.type === "enable_overflow"
        ? { overflowNotifyEnabled: true }
        : { briefingEnabled: true, briefingHour: 8 };
    await db
      .insert(schema.userPreferences)
      .values({ userId: u.id, ...set })
      .onConflictDoUpdate({ target: schema.userPreferences.userId, set });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("proactive suggestion action failed", {
      event: "proactive_action_failed",
      userId: u.id,
      type: d.type,
      err,
    });
    return jsonError("Couldn't do that. Please try again.", 502);
  }
});
