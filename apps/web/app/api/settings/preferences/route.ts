import { jsonError, withUser } from "@/lib/server/http";
import { DEFAULT_REMINDER_OFFSETS } from "@calsync/core";
import { eq, getDb, schema } from "@calsync/db";
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
});

export const PATCH = withUser(async (u, request) => {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid preferences", 400);
  const d = parsed.data;

  // De-duplicate + sort reminder offsets (largest lead time first).
  const offsets = [...new Set(d.defaultReminderOffsets)].sort((a, b) => b - a);

  await getDb()
    .insert(schema.userPreferences)
    .values({
      userId: u.id,
      timeFormat: d.timeFormat,
      weekStartsOn: d.weekStartsOn,
      theme: d.theme,
      defaultReminderOffsets: offsets,
      adaptiveAvailability: d.adaptiveAvailability,
      maxMeetingsPerDay: d.maxMeetingsPerDay,
    })
    .onConflictDoUpdate({
      target: schema.userPreferences.userId,
      set: {
        timeFormat: d.timeFormat,
        weekStartsOn: d.weekStartsOn,
        theme: d.theme,
        defaultReminderOffsets: offsets,
        adaptiveAvailability: d.adaptiveAvailability,
        maxMeetingsPerDay: d.maxMeetingsPerDay,
      },
    });

  return NextResponse.json({ ok: true });
});
