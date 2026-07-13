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
      lunchEnabled: prefs?.lunchEnabled ?? false,
      lunchStartMinute: prefs?.lunchStartMinute ?? 720,
      lunchEndMinute: prefs?.lunchEndMinute ?? 780,
    },
  });
});

const bodySchema = z.object({
  timeFormat: z.enum(["12h", "24h"]),
  weekStartsOn: z.number().int().min(0).max(6),
  theme: z.enum(["system", "light", "dark"]),
  defaultReminderOffsets: z.array(z.number().int().min(0).max(43_200)).max(5),
  adaptiveAvailability: z.boolean().default(false),
  maxMeetingsPerDay: z.number().int().min(1).max(20).default(5),
  travelBufferMinutes: z.number().int().min(0).max(240).default(0),
  reclaimCancelledTime: z.boolean().default(false),
  overflowNotifyEnabled: z.boolean().default(false),
  lunchEnabled: z.boolean().default(false),
  lunchStartMinute: z.number().int().min(0).max(1439).default(720),
  lunchEndMinute: z.number().int().min(1).max(1440).default(780),
});

export const PATCH = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid preferences", 400);
  const d = parsed.data;

  // De-duplicate + sort reminder offsets (largest lead time first).
  const offsets = [...new Set(d.defaultReminderOffsets)].sort((a, b) => b - a);
  // Guard against an inverted lunch window (end must be after start).
  const lunchEnabled = d.lunchEnabled && d.lunchEndMinute > d.lunchStartMinute;

  const fields = {
    timeFormat: d.timeFormat,
    weekStartsOn: d.weekStartsOn,
    theme: d.theme,
    defaultReminderOffsets: offsets,
    adaptiveAvailability: d.adaptiveAvailability,
    maxMeetingsPerDay: d.maxMeetingsPerDay,
    travelBufferMinutes: d.travelBufferMinutes,
    reclaimCancelledTime: d.reclaimCancelledTime,
    overflowNotifyEnabled: d.overflowNotifyEnabled,
    lunchEnabled,
    lunchStartMinute: d.lunchStartMinute,
    lunchEndMinute: d.lunchEndMinute,
  };

  await getDb()
    .insert(schema.userPreferences)
    .values({ userId: u.id, ...fields })
    .onConflictDoUpdate({ target: schema.userPreferences.userId, set: fields });

  return NextResponse.json({ ok: true });
});
