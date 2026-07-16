import { jsonError, withUser } from "@/lib/server/http";
import { DEFAULT_REMINDER_OFFSETS } from "@dayotter/core";
import { eq, getDb, schema } from "@dayotter/db";
import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

/** Current preferences (mobile settings screen). Returns defaults if unset. */
export const GET = withUser(async (u) => {
  const prefs = await getDb().query.userPreferences.findFirst({
    where: eq(schema.userPreferences.userId, u.id),
  });
  return NextResponse.json({
    preferences: {
      timeFormat: prefs?.timeFormat ?? "12h",
      weekStartsOn: prefs?.weekStartsOn ?? 0,
      theme: prefs?.theme ?? "system",
      defaultReminderOffsets: prefs?.defaultReminderOffsets ?? [...DEFAULT_REMINDER_OFFSETS],
      adaptiveAvailability: prefs?.adaptiveAvailability ?? false,
      maxMeetingsPerDay: prefs?.maxMeetingsPerDay ?? 5,
      travelBufferMinutes: prefs?.travelBufferMinutes ?? 0,
      reclaimCancelledTime: prefs?.reclaimCancelledTime ?? false,
      overflowNotifyEnabled: prefs?.overflowNotifyEnabled ?? false,
      briefingEnabled: prefs?.briefingEnabled ?? false,
      briefingHour: prefs?.briefingHour ?? 8,
      scribeEnabled: prefs?.scribeEnabled ?? false,
      lunchEnabled: prefs?.lunchEnabled ?? false,
      lunchStartMinute: prefs?.lunchStartMinute ?? 720,
      lunchEndMinute: prefs?.lunchEndMinute ?? 780,
      bookingPageAssistant: prefs?.bookingPageAssistant ?? true,
    },
  });
});

// Every field is optional: this is a PARTIAL update. A client (e.g. the mobile
// app) that sends only a subset must NOT reset the fields it omits - previously
// zod `.default()` + a full write silently wiped any preference the caller
// didn't include, so a mobile save reset lunch/scribe/briefing/theme/etc.
const bodySchema = z.object({
  timeFormat: z.enum(["12h", "24h"]).optional(),
  weekStartsOn: z.number().int().min(0).max(6).optional(),
  theme: z.enum(["system", "light", "dark"]).optional(),
  defaultReminderOffsets: z.array(z.number().int().min(0).max(43_200)).max(5).optional(),
  adaptiveAvailability: z.boolean().optional(),
  maxMeetingsPerDay: z.number().int().min(1).max(20).optional(),
  travelBufferMinutes: z.number().int().min(0).max(240).optional(),
  reclaimCancelledTime: z.boolean().optional(),
  overflowNotifyEnabled: z.boolean().optional(),
  briefingEnabled: z.boolean().optional(),
  briefingHour: z.number().int().min(0).max(23).optional(),
  scribeEnabled: z.boolean().optional(),
  lunchEnabled: z.boolean().optional(),
  lunchStartMinute: z.number().int().min(0).max(1439).optional(),
  lunchEndMinute: z.number().int().min(1).max(1440).optional(),
  bookingPageAssistant: z.boolean().optional(),
});

export const PATCH = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid preferences", 400);
  const d = parsed.data;

  // Build the update from ONLY the keys the client actually sent.
  const fields: Partial<typeof schema.userPreferences.$inferInsert> = {};
  if (d.timeFormat !== undefined) fields.timeFormat = d.timeFormat;
  if (d.weekStartsOn !== undefined) fields.weekStartsOn = d.weekStartsOn;
  if (d.theme !== undefined) fields.theme = d.theme;
  if (d.defaultReminderOffsets !== undefined) {
    // De-duplicate + sort reminder offsets (largest lead time first).
    fields.defaultReminderOffsets = [...new Set(d.defaultReminderOffsets)].sort((a, b) => b - a);
  }
  if (d.adaptiveAvailability !== undefined) fields.adaptiveAvailability = d.adaptiveAvailability;
  if (d.maxMeetingsPerDay !== undefined) fields.maxMeetingsPerDay = d.maxMeetingsPerDay;
  if (d.travelBufferMinutes !== undefined) fields.travelBufferMinutes = d.travelBufferMinutes;
  if (d.reclaimCancelledTime !== undefined) fields.reclaimCancelledTime = d.reclaimCancelledTime;
  if (d.overflowNotifyEnabled !== undefined) fields.overflowNotifyEnabled = d.overflowNotifyEnabled;
  if (d.briefingEnabled !== undefined) fields.briefingEnabled = d.briefingEnabled;
  if (d.briefingHour !== undefined) fields.briefingHour = d.briefingHour;
  if (d.scribeEnabled !== undefined) fields.scribeEnabled = d.scribeEnabled;
  if (d.lunchStartMinute !== undefined) fields.lunchStartMinute = d.lunchStartMinute;
  if (d.lunchEndMinute !== undefined) fields.lunchEndMinute = d.lunchEndMinute;
  if (d.bookingPageAssistant !== undefined) fields.bookingPageAssistant = d.bookingPageAssistant;
  // Guard against an inverted lunch window (end must be after start) when enabling.
  if (d.lunchEnabled !== undefined) {
    const start = d.lunchStartMinute ?? 720;
    const end = d.lunchEndMinute ?? 780;
    fields.lunchEnabled = d.lunchEnabled && end > start;
  }

  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: true });

  await getDb()
    .insert(schema.userPreferences)
    .values({ userId: u.id, ...fields })
    .onConflictDoUpdate({ target: schema.userPreferences.userId, set: fields });

  return NextResponse.json({ ok: true });
});
