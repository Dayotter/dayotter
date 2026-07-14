import { aiEnabled } from "@/lib/ai/schedule-parse";
import { createHostBooking } from "@/lib/booking/host-booking";
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
  /** Optional: a real event type the create maps to (so its workflows apply). */
  eventTypeSlug: z.string().max(200).optional(),
});

/**
 * Write a confirmed AI draft as a real DayOtter booking. This is the
 * human-confirmed step — the AI never reaches here on its own. Goes through the
 * host-booking engine so the meeting shows in the app and gets reminders,
 * overflow and scribe (not just a raw calendar event).
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
    const result = await createHostBooking({
      userId: u.id,
      title: d.title,
      start,
      end,
      timezone: user?.timezone ?? "UTC",
      notes: d.notes,
      attendees,
      eventTypeSlug: d.eventTypeSlug,
    });
    if (!result) return jsonError("Couldn't add the event. Please try again.", 502);
    logger.info("ai event created", { event: "ai_event_created", userId: u.id });
    return NextResponse.json({ ok: true, uid: result.uid, meetingUrl: result.meetingUrl });
  } catch (err) {
    logger.error("ai event create failed", { event: "ai_event_create_failed", userId: u.id, err });
    return jsonError("Couldn't add the event. Please try again.", 502);
  }
});
