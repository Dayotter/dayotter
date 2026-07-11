import { aiEnabled } from "@/lib/ai/schedule-parse";
import { writeBookingToCalendar } from "@/lib/calendar/host-calendar";
import { jsonError, withUser } from "@/lib/server/http";
import { logger } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const body = z.object({
  title: z.string().min(1).max(200),
  startISO: z.string().datetime(),
  durationMinutes: z.number().int().min(5).max(1440),
  notes: z.string().max(2000).optional(),
  attendees: z
    .array(z.object({ name: z.string(), email: z.string() }))
    .max(20)
    .default([]),
});

/**
 * Write a confirmed AI draft to the user's calendar. This is the human-confirmed
 * step — the AI never reaches here on its own. Best-effort: needs a connected
 * calendar to land the event.
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the draft details", 400);
  const d = parsed.data;

  const start = new Date(d.startISO);
  const end = new Date(start.getTime() + d.durationMinutes * 60_000);

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });

  const attendees = d.attendees
    .filter((a) => a.email.includes("@"))
    .map((a) => ({ email: a.email, name: a.name || undefined }));

  try {
    const written = await writeBookingToCalendar(u.id, {
      title: d.title,
      description: d.notes,
      start,
      end,
      timezone: user?.timezone ?? "UTC",
      attendees,
    });
    if (!written) {
      return jsonError("Connect a calendar first so events have somewhere to land.", 409);
    }
    logger.info("ai event created", { event: "ai_event_created", userId: u.id });
    return NextResponse.json({ ok: true, meetingUrl: written.meetingUrl });
  } catch (err) {
    logger.error("ai event create failed", { event: "ai_event_create_failed", userId: u.id, err });
    return jsonError("Couldn't add the event. Please try again.", 502);
  }
});
