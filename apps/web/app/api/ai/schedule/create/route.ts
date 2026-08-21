import { aiEnabled } from "@/lib/ai/schedule-parse";
import { LOCATION_TYPES } from "@/lib/booking/event-type-input";
import { createOtterEvent } from "@/lib/booking/otter-create";
import { jsonError, withUser } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
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
  /** "focus" is held as a personal focus block (not a meeting/booking). */
  kind: z.enum(["meeting", "focus", "reminder"]).optional(),
  /** Ad-hoc meeting location ("on Zoom / Meet / phone") when there's no event type.
   * Lenient: an unexpected value falls back to no location rather than 400-ing. */
  location: z.enum(LOCATION_TYPES).optional().catch(undefined),
  locationDetail: z.string().max(500).optional(),
  /** Repetition. "none" = single. recurrenceCount is the TOTAL events to create.
   * Lenient so a stray value degrades to a single event rather than 400-ing. */
  recurrenceFreq: z
    .enum(["none", "daily", "weekdays", "weekly", "consecutive"])
    .optional()
    .catch("none"),
  recurrenceDays: z.array(z.number().int().min(0).max(6)).max(7).optional().catch([]),
  recurrenceCount: z.number().int().min(1).max(60).optional().catch(1),
});

/**
 * Write a confirmed AI draft as a real DayOtter booking. This is the
 * human-confirmed step - the AI never reaches here on its own. Goes through the
 * host-booking engine so the meeting shows in the app and gets reminders,
 * overflow and scribe (not just a raw calendar event).
 */
export const POST = withUser(async (u, request) => {
  if (!aiEnabled) return jsonError("AI scheduling isn't enabled on this server.", 503);

  // Writes a real booking (calendar + attendee emails) - throttle per host.
  const limited = await enforceRateLimit(request, {
    name: "ai-schedule-create",
    limit: 20,
    windowSec: 600,
    key: u.id,
  });
  if (limited) return limited;

  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Check the draft details", 400);
  const d = parsed.data;

  const start = new Date(d.startISO);

  const user = await getDb().query.users.findFirst({
    where: eq(schema.users.id, u.id),
    columns: { timezone: true },
  });

  const attendees = d.attendees
    .filter((a) => a.email.includes("@"))
    .map((a) => ({ email: a.email, name: a.name || undefined }));

  const timezone = user?.timezone ?? "UTC";
  const isHold = d.kind === "focus" || d.kind === "reminder";

  try {
    const result = await createOtterEvent({
      userId: u.id,
      title: d.title,
      start,
      durationMinutes: d.durationMinutes,
      timezone,
      notes: d.notes,
      attendees,
      eventTypeSlug: d.eventTypeSlug,
      location: d.location,
      locationDetail: d.locationDetail,
      kind: d.kind,
      recurrenceFreq: d.recurrenceFreq,
      recurrenceDays: d.recurrenceDays,
      recurrenceCount: d.recurrenceCount,
    });
    if (result.count === 0) {
      return jsonError(
        isHold
          ? "Couldn't hold that time. Please try again."
          : "Couldn't add the event. Please try again.",
        502,
      );
    }
    logger.info("ai create", {
      event: isHold ? "ai_hold_created" : "ai_event_created",
      userId: u.id,
      kind: d.kind ?? "meeting",
      count: result.count,
    });
    return NextResponse.json({
      ok: true,
      uid: result.uid,
      meetingUrl: result.meetingUrl,
      count: result.count,
    });
  } catch (err) {
    logger.error("ai create failed", { event: "ai_create_failed", userId: u.id, err });
    return jsonError(
      isHold
        ? "Couldn't hold that time. Please try again."
        : "Couldn't add the event. Please try again.",
      502,
    );
  }
});
